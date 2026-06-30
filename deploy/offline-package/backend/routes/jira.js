/**
 * Jira 路由模块
 * GET    /api/jira/templates               - 获取所有模板
 * POST   /api/jira/templates               - 新增模板
 * PUT    /api/jira/templates/:id           - 更新模板
 * DELETE /api/jira/templates/:id           - 删除模板
 * POST   /api/jira/tickets                 - 创建工单（支持批量 reporters）
 * GET    /api/jira/issues/:issueKey         - 查询工单信息
 * GET    /api/jira/issues/:issueKey/transitions - 获取可用操作
 * POST   /api/jira/issues/:issueKey/comments   - 添加评论
 * POST   /api/jira/issues/:issueKey/transition  - 执行 transition
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  createJiraClient,
  fillTemplate, createFullTicket,
  getTicket, getTransitions, addComment, doTransition, searchTickets, searchUsers, autoDetectInternalComponent, getInternalComponentOptions,
  getUserConfig, setUserConfig, deleteUserConfig,
} = require('../services/jiraService');

const TEMPLATES_FILE = path.join(__dirname, '../config/jiraTemplates.json');
const JIRA_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const jiraMetadataCache = {
  approvalStatuses: new Map(),
  approverFieldIds: new Map(),
};

function getJiraCacheKey(config) {
  return String(config?.jiraUrl || 'default');
}

function readJiraMetadataCache(bucket, cacheKey) {
  const entry = bucket.get(cacheKey);
  if (!entry) return null;
  if ((Date.now() - entry.cachedAt) > JIRA_METADATA_CACHE_TTL_MS) {
    bucket.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function writeJiraMetadataCache(bucket, cacheKey, value) {
  bucket.set(cacheKey, { value, cachedAt: Date.now() });
  return value;
}

function escapeJqlValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeIdentity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');
}

function extractIdentityCandidates(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const out = [raw];
  if (raw.includes('@')) out.push(raw.split('@')[0]);
  return out;
}

function buildCurrentIdentitySet(currentUser) {
  return new Set(
    [
      ...extractIdentityCandidates(currentUser?.username),
      ...extractIdentityCandidates(currentUser?.userId),
      ...extractIdentityCandidates(currentUser?.displayName),
      ...extractIdentityCandidates(currentUser?.email),
    ].map(normalizeIdentity).filter(Boolean)
  );
}

function issueHasApproverMatch(fields, approverFieldIds, currentIdentitySet) {
  if (!fields || !Array.isArray(approverFieldIds) || approverFieldIds.length === 0 || currentIdentitySet.size === 0) {
    return false;
  }

  return approverFieldIds.some((fieldId) => {
    const approvers = fields[fieldId];
    if (!Array.isArray(approvers) || approvers.length === 0) return false;

    return approvers.some((approver) => {
      const values = [
        ...extractIdentityCandidates(approver?.name),
        ...extractIdentityCandidates(approver?.key),
        ...extractIdentityCandidates(approver?.displayName),
        ...extractIdentityCandidates(approver?.emailAddress),
      ];
      return values.some((value) => currentIdentitySet.has(normalizeIdentity(value)));
    });
  });
}

async function getApprovalStatusNames(client, jiraConfig) {
  const cacheKey = getJiraCacheKey(jiraConfig);
  const cached = readJiraMetadataCache(jiraMetadataCache.approvalStatuses, cacheKey);
  if (cached) return cached;

  const statusResp = await client.get('/rest/api/2/status');
  const approvalStatusNames = (statusResp.data || [])
    .filter((status) => /approval/i.test(status.name))
    .map((status) => status.name)
    .filter(Boolean);

  return writeJiraMetadataCache(jiraMetadataCache.approvalStatuses, cacheKey, approvalStatusNames);
}

async function getApproverFieldIds(client, jiraConfig) {
  const cacheKey = getJiraCacheKey(jiraConfig);
  const cached = readJiraMetadataCache(jiraMetadataCache.approverFieldIds, cacheKey);
  if (cached) return cached;

  const fieldsResp = await client.get('/rest/api/2/field');
  const approverFieldIds = (fieldsResp.data || [])
    .filter((field) => field?.id?.startsWith('customfield_'))
    .filter((field) => /approver|approval/i.test(String(field?.name || '')))
    .map((field) => field.id);

  return writeJiraMetadataCache(jiraMetadataCache.approverFieldIds, cacheKey, Array.from(new Set(approverFieldIds)));
}

// ── Helper: resolve user's Jira config (returns null if not configured) ─────
function resolveUserConfig(req) {
  const userId = req.user?.userId;
  if (!userId) return null;
  return getUserConfig(userId);
}

// ── Middleware: require Jira config before using Jira API endpoints ──────────
function requireJiraConfig(req, res, next) {
  const config = resolveUserConfig(req);
  if (!config || !config.jiraUrl || !config.jiraPat) {
    return res.apiError('Jira not configured. Please set up your Jira Server URL and API Token in Configuration.', 403);
  }
  req.jiraConfig = config;
  next();
}

function loadTemplates() {
  return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
}

function saveTemplates(templates) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf8');
}

// ── Comment Templates (shared, persisted on backend) ────────────────────────
const COMMENT_TEMPLATES_FILE = path.join(__dirname, '../config/commentTemplates.json');

function loadCommentTemplates() {
  try { return JSON.parse(fs.readFileSync(COMMENT_TEMPLATES_FILE, 'utf8')); }
  catch { return []; }
}
function saveCommentTemplatesFile(data) {
  fs.writeFileSync(COMMENT_TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /comment-templates
router.get('/comment-templates', (req, res) => {
  res.apiSuccess(loadCommentTemplates(), 'Comment templates loaded');
});

// POST /comment-templates  { text: string }
router.post('/comment-templates', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.apiError('text is required', 400);
  const templates = loadCommentTemplates();
  const entry = { id: uuidv4(), text: text.trim(), createdBy: req.user?.username || 'unknown', createdAt: new Date().toISOString() };
  templates.push(entry);
  saveCommentTemplatesFile(templates);
  res.apiSuccess(entry, 'Comment template added');
});

// DELETE /comment-templates/:id
router.delete('/comment-templates/:id', (req, res) => {
  const templates = loadCommentTemplates();
  const idx = templates.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.apiError('Template not found', 404);
  const entry = templates[idx];
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'Administrator';
  const isOwner = entry.createdBy === req.user?.username;
  if (!isAdmin && !isOwner) {
    return res.apiError('Permission denied: you can only delete your own templates', 403);
  }
  templates.splice(idx, 1);
  saveCommentTemplatesFile(templates);
  res.apiSuccess(null, 'Comment template deleted');
});

// GET /internal-component-options?componentId=xxx
// 获取某个 Component 下 Internal Component 的全部可选项（用于模板编辑器下拉）
router.get('/internal-component-options', requireJiraConfig, async (req, res) => {
  try {
    const { componentId } = req.query;
    if (!componentId) return res.apiError('componentId is required', 400);
    const userConfig = resolveUserConfig(req);
    const result = await getInternalComponentOptions({ componentId, userConfig });
    res.apiSuccess(result, 'Internal component options fetched');
  } catch (error) {
    res.apiError('Failed to fetch internal component options', 500, error.message);
  }
});

// GET /templates/auto-detect-internal-component - 放在其他路由之前
router.get('/templates', (req, res) => {
  try {
    res.apiSuccess(loadTemplates(), 'Templates fetched');
  } catch (error) {
    res.apiError('Failed to load templates', 500, error.message);
  }
});
router.get('/templates/auto-detect-internal-component', requireJiraConfig, async (req, res) => {
  try {
    const { summaryTemplate, componentId } = req.query;
    if (!summaryTemplate || !componentId) {
      return res.apiError('summaryTemplate and componentId are required', 400);
    }

    const userConfig = resolveUserConfig(req);
    const candidates = await autoDetectInternalComponent({
      summaryTemplate,
      componentId,
      userConfig,
    });

    res.apiSuccess(candidates, 'Internal component candidates detected');
  } catch (error) {
    res.apiError('Failed to detect internal component', 500, error.message);
  }
});

// POST /templates
router.post('/templates', (req, res) => {
  try {
    const templates = loadTemplates();
    const newTemplate = {
      id: uuidv4(),
      category: req.body.category || 'custom',
      name: req.body.name,
      componentId: req.body.componentId,
      summaryTemplate: req.body.summaryTemplate,
      descriptionTemplate: req.body.descriptionTemplate,
      inputs: req.body.inputs || [],
      extraFields: req.body.extraFields || null,
      internalComponentCategory: req.body.internalComponentCategory || '',
      internalComponentSubCategory: req.body.internalComponentSubCategory || '',
      internalComponentCategoryId: req.body.internalComponentCategoryId || '',
      internalComponentSubCategoryId: req.body.internalComponentSubCategoryId || '',
      internalComponentFieldId: req.body.internalComponentFieldId || '',
    };
    if (!newTemplate.name || !newTemplate.componentId || !newTemplate.summaryTemplate) {
      return res.apiError('name, componentId, summaryTemplate are required', 400);
    }
    templates.push(newTemplate);
    saveTemplates(templates);
    res.apiSuccess(newTemplate, 'Template created');

    // 异步自动检测（不阻塞响应）
    const userConfig = resolveUserConfig(req);
    if (userConfig && newTemplate.summaryTemplate && newTemplate.componentId) {
      setImmediate(async () => {
        try {
          const match = await autoDetectInternalComponent({
            summaryTemplate: newTemplate.summaryTemplate,
            componentId: newTemplate.componentId,
            userConfig,
          });
          if (match && match.category) {
            const latest = loadTemplates();
            const i = latest.findIndex(t => t.id === newTemplate.id);
            if (i !== -1 && !latest[i].internalComponentCategoryId) {
              latest[i].internalComponentCategory = match.category;
              latest[i].internalComponentSubCategory = match.subCategory || '';
              latest[i].internalComponentCategoryId = match.categoryId || '';
              latest[i].internalComponentSubCategoryId = match.subCategoryId || '';
              latest[i].internalComponentFieldId = match.fieldId || latest[i].internalComponentFieldId || '';
              saveTemplates(latest);
              console.log(`[autoDetect] Template "${newTemplate.name}": set category="${match.category}" sub="${match.subCategory}"`);
            }
          }
        } catch (e) {
          console.error('[autoDetect] POST background error:', e.message);
        }
      });
    }
  } catch (error) {
    res.apiError('Failed to create template', 500, error.message);
  }
});

// PUT /templates/:id
router.put('/templates/:id', (req, res) => {
  try {
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.apiError('Template not found', 404);

    templates[idx] = {
      ...templates[idx],
      name: req.body.name ?? templates[idx].name,
      category: req.body.category ?? templates[idx].category,
      componentId: req.body.componentId ?? templates[idx].componentId,
      summaryTemplate: req.body.summaryTemplate ?? templates[idx].summaryTemplate,
      descriptionTemplate: req.body.descriptionTemplate ?? templates[idx].descriptionTemplate,
      inputs: req.body.inputs ?? templates[idx].inputs,
      extraFields: req.body.extraFields ?? templates[idx].extraFields,
      internalComponentCategory: req.body.internalComponentCategory ?? templates[idx].internalComponentCategory ?? '',
      internalComponentSubCategory: req.body.internalComponentSubCategory ?? templates[idx].internalComponentSubCategory ?? '',
      internalComponentCategoryId: req.body.internalComponentCategoryId ?? templates[idx].internalComponentCategoryId ?? '',
      internalComponentSubCategoryId: req.body.internalComponentSubCategoryId ?? templates[idx].internalComponentSubCategoryId ?? '',
      internalComponentFieldId: req.body.internalComponentFieldId ?? templates[idx].internalComponentFieldId ?? '',
    };
    saveTemplates(templates);
    res.apiSuccess(templates[idx], 'Template updated');

    // 如果此次更新不是覆写 internalComponentCategoryId（即不是关单回写），则尝试后台自动检测
    const isCloseSyncWrite = (req.body.internalComponentCategoryId !== undefined);
    if (!isCloseSyncWrite) {
      const userConfig = resolveUserConfig(req);
      const tmpl = templates[idx];
      if (userConfig && tmpl.summaryTemplate && tmpl.componentId) {
        setImmediate(async () => {
          try {
            const match = await autoDetectInternalComponent({
              summaryTemplate: tmpl.summaryTemplate,
              componentId: tmpl.componentId,
              userConfig,
            });
            if (match && match.category) {
              const latest = loadTemplates();
              const i = latest.findIndex(t => t.id === tmpl.id);
              // 只有当前模板尚无 ID 时才写入（已有手动或关单回写的不覆盖）
              if (i !== -1 && !latest[i].internalComponentCategoryId) {
                latest[i].internalComponentCategory = match.category;
                latest[i].internalComponentSubCategory = match.subCategory || '';
                latest[i].internalComponentCategoryId = match.categoryId || '';
                latest[i].internalComponentSubCategoryId = match.subCategoryId || '';
                latest[i].internalComponentFieldId = match.fieldId || latest[i].internalComponentFieldId || '';
                saveTemplates(latest);
                console.log(`[autoDetect] Template "${tmpl.name}": set category="${match.category}" sub="${match.subCategory}"`);
              }
            }
          } catch (e) {
            console.error('[autoDetect] PUT background error:', e.message);
          }
        });
      }
    }
  } catch (error) {
    res.apiError('Failed to update template', 500, error.message);
  }
});

// DELETE /templates/:id
router.delete('/templates/:id', (req, res) => {
  try {
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.apiError('Template not found', 404);
    templates.splice(idx, 1);
    saveTemplates(templates);
    res.apiSuccess(null, 'Template deleted');
  } catch (error) {
    res.apiError('Failed to delete template', 500, error.message);
  }
});

// POST /templates/batch-detect-internal-component
// 批量检测所有尚无 Internal Component 的模板，自动写入 category/subCategory
// 前端加载模板列表时调用一次
router.post('/templates/batch-detect-internal-component', requireJiraConfig, async (req, res) => {
  const userConfig = resolveUserConfig(req);
  // 立即响应，后台异步处理
  res.apiSuccess({ started: true }, 'Batch detection started in background');

  setImmediate(async () => {
    try {
      const templates = loadTemplates();
      const undetected = templates.filter(t =>
        t.summaryTemplate && t.componentId && !t.internalComponentCategoryId && !t.internalComponentCategory
      );
      console.log(`[autoDetect] Batch: ${undetected.length} templates to process`);

      for (const tmpl of undetected) {
        try {
          const match = await autoDetectInternalComponent({
            summaryTemplate: tmpl.summaryTemplate,
            componentId: tmpl.componentId,
            userConfig,
          });
          if (match && match.category) {
            const latest = loadTemplates();
            const i = latest.findIndex(t => t.id === tmpl.id);
            if (i !== -1 && !latest[i].internalComponentCategoryId && !latest[i].internalComponentCategory) {
              latest[i].internalComponentCategory = match.category;
              latest[i].internalComponentSubCategory = match.subCategory || '';
              latest[i].internalComponentCategoryId = match.categoryId || '';
              latest[i].internalComponentSubCategoryId = match.subCategoryId || '';
              latest[i].internalComponentFieldId = match.fieldId || latest[i].internalComponentFieldId || '';
              saveTemplates(latest);
              console.log(`[autoDetect] Batch: "${tmpl.name}" → "${match.category}" / "${match.subCategory}"`);
            }
          }
        } catch (e) {
          console.error(`[autoDetect] Batch error for template "${tmpl.name}":`, e.message);
        }
        // 防止请求过快导致 API 限流
        await new Promise(r => setTimeout(r, 300));
      }
      console.log('[autoDetect] Batch complete');
    } catch (e) {
      console.error('[autoDetect] Batch fatal error:', e.message);
    }
  });
});

// POST /tickets  创建工单（支持批量 reporters）
router.post('/tickets', requireJiraConfig, async (req, res) => {
  try {
    const { templateId, reporters, assignee, customSummary, customDescription, vars = {} } = req.body;

    if (!templateId || !reporters || reporters.length === 0) {
      return res.apiError('templateId and reporters are required', 400);
    }

    const templates = loadTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return res.apiError('Template not found', 404);

    // 为每个 reporter 使用其 NTID 替换 {ntid} 变量，并查找 displayName 用于 {fullname}
    const client = createJiraClient(req.jiraConfig);
    const results = await Promise.allSettled(
      reporters.map(async (reporter) => {
        // Resolve fullname from Jira if not provided in vars
        let resolvedVars = { ...vars };
        if (!resolvedVars.fullname) {
          try {
            const userResp = await client.get(`/rest/api/2/user?username=${encodeURIComponent(reporter)}`);
            resolvedVars.fullname = userResp.data?.displayName || reporter;
          } catch {
            resolvedVars.fullname = reporter;
          }
        }

        const summaryTemplate = customSummary && customSummary.trim()
          ? customSummary
          : template.summaryTemplate;
        const summary = fillTemplate(summaryTemplate, resolvedVars, reporter);
        
        const descTemplate = customDescription && customDescription.trim()
          ? customDescription
          : template.descriptionTemplate;
        const description = fillTemplate(descTemplate, resolvedVars, reporter);

        return createFullTicket({
          reporter,
          summary,
          description,
          assignee,
          componentId: template.componentId,
          extraFields: template.extraFields,
          userConfig: req.jiraConfig,
        });
      })
    );

    const tickets = results.map((r, i) => ({
      reporter: reporters[i],
      success: r.status === 'fulfilled',
      issueKey: r.status === 'fulfilled' ? r.value.issueKey : null,
      url: r.status === 'fulfilled' ? r.value.url : null,
      extraFieldsSkipped: r.status === 'fulfilled' ? r.value.extraFieldsSkipped : false,
      assigneeSkipped: r.status === 'fulfilled' ? r.value.assigneeSkipped : false,
      error: r.status === 'rejected' ? r.reason?.response?.data?.errorMessage || r.reason?.message : null,
    }));

    res.apiSuccess(tickets, 'Tickets creation completed');
  } catch (error) {
    res.apiError('Failed to create tickets', 500, error.message);
  }
});

// GET /users/search  搜索 Jira 用户（自动补全）
router.get('/users/search', requireJiraConfig, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 1) return res.apiSuccess([], 'No query');
    const users = await searchUsers(query, req.jiraConfig);
    res.apiSuccess(users, 'Users found');
  } catch (error) {
    res.apiError('Failed to search users', 500, error.message);
  }
});

// GET /issues/:issueKey  查询工单信息
router.get('/issues/:issueKey', requireJiraConfig, async (req, res) => {
  try {
    const ticket = await getTicket(req.params.issueKey.toUpperCase(), req.jiraConfig);
    res.apiSuccess(ticket, 'Ticket fetched');
  } catch (error) {
    const status = error.response?.status === 404 ? 404 : 500;
    res.apiError('Ticket not found or fetch failed', status,
      error.response?.data?.errorMessages?.[0] || error.message);
  }
});

// GET /issues  多条件搜索工单
router.get('/issues', requireJiraConfig, async (req, res) => {
  try {
    const {
      issueKey = '',
      reporter = '',
      assignee = '',
      status = '',
      dateFrom = '',
      dateTo = '',
      maxResults = '50',
      startAt = '0',
    } = req.query;

    const parsedMaxResults = Math.min(Math.max(parseInt(maxResults, 10) || 50, 1), 100);
    const parsedStartAt = Math.max(parseInt(startAt, 10) || 0, 0);

    const result = await searchTickets({
      issueKey: String(issueKey).trim(),
      reporter: String(reporter).trim(),
      assignee: String(assignee).trim(),
      status: String(status).trim(),
      dateFrom: String(dateFrom).trim(),
      dateTo: String(dateTo).trim(),
      maxResults: parsedMaxResults,
      startAt: parsedStartAt,
      userConfig: req.jiraConfig,
    });

    res.apiSuccess(result, 'Tickets searched');
  } catch (error) {
    const status = error.response?.status || 500;
    const details = error.response?.data?.errorMessages?.[0] || error.message;
    res.apiError(
      'Failed to search tickets',
      status,
      details
    );
  }
});

// DEBUG: GET /debug-fields/:issueKey  调试字段
router.get('/debug-fields/:issueKey', requireJiraConfig, async (req, res) => {
  try {
    const client = createJiraClient(req.jiraConfig);
    const issueResp = await client.get(`/rest/api/2/issue/${req.params.issueKey}`);
    const fields = issueResp.data.fields || {};
    const debug = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('customfield_')) {
        if (Array.isArray(value) && value.length > 0) {
          debug[key] = {
            type: 'array',
            length: value.length,
            sample: JSON.stringify(value[0]).substring(0, 100)
          };
        } else if (value !== null && value !== undefined) {
          debug[key] = {
            type: typeof value,
            value: String(value).substring(0, 50)
          };
        }
      }
    }
    res.apiSuccess(debug, 'Debug info');
  } catch (error) {
    res.apiError('Failed to fetch debug info', 500, error.message);
  }
});

// GET /pending-approvals  查询待当前用户审批的工单
// 筛选条件：
//   1. 工单状态名称含 "approval" 关键字（JQL: status ~ "approval"）
//   2. 当前用户在工单的 Approvers 自定义字段中 且 尚未执行 Approve 操作
//      ——检测依据：getTransitions 返回的 transition 名含 "approve"（包括 Jira 返回的真实
//        transition 和我们的合成 approve-added）
router.get('/pending-approvals', requireJiraConfig, async (req, res) => {
  const { dateFrom = '', dateTo = '' } = req.query;

  try {
    const client = createJiraClient(req.jiraConfig);
    const jiraUrl = req.jiraConfig?.jiraUrl || '';

    // Get current user's Jira identity
    let jiraIdentity = '';
    try {
      const myselfResp = await client.get('/rest/api/2/myself');
      jiraIdentity = myselfResp.data?.name || '';
    } catch { /* */ }
    if (!jiraIdentity) {
      return res.apiError('Could not determine Jira identity', 500);
    }

    const addOneDay = (ymd) => {
      const dt = new Date(`${ymd}T00:00:00`);
      if (Number.isNaN(dt.getTime())) return '';
      dt.setDate(dt.getDate() + 1);
      return dt.toISOString().slice(0, 10);
    };

    // Build date constraints
    const dateParts = [];
    if (dateFrom) dateParts.push(`created >= "${String(dateFrom).trim()}"`);
    if (dateTo) {
      const nextDay = addOneDay(String(dateTo).trim());
      if (nextDay) dateParts.push(`created < "${nextDay}"`);
    }
    const dateClause = dateParts.length > 0 ? ` AND ${dateParts.join(' AND ')}` : '';

    // Targeted queries: each combines a specific approval status with its corresponding approver field
    const queries = [
      { jql: `status = "Waiting for approval" AND Approvers = "${escapeJqlValue(jiraIdentity)}"${dateClause} ORDER BY created DESC` },
      { jql: `status = "Technical Approval" AND "Technical Approvers" = "${escapeJqlValue(jiraIdentity)}"${dateClause} ORDER BY created DESC` },
      { jql: `status = "Waiting for Manager's approval" AND Approvers = "${escapeJqlValue(jiraIdentity)}"${dateClause} ORDER BY created DESC` },
      { jql: `status = "Line Manager Approval" AND "Line Manager Approver" = "${escapeJqlValue(jiraIdentity)}"${dateClause} ORDER BY created DESC` },
      { jql: `status = "Peer Approval" AND "Tech Review Approver" = "${escapeJqlValue(jiraIdentity)}"${dateClause} ORDER BY created DESC` },
    ];

    const requestedFields = 'summary,status,reporter,assignee,issuetype,components,created,updated,description,customfield_10207,customfield_10208';

    const mapIssue = (issue) => {
      const f = issue.fields || {};
      return {
        key: issue.key,
        summary: f.summary,
        description: f.description || '',
        status: f.status?.name,
        statusCategory: f.status?.statusCategory?.colorName,
        reporter: f.reporter?.displayName || f.reporter?.name,
        assignee: f.assignee?.displayName || f.assignee?.name || '未分配',
        issuetype: f.issuetype?.name,
        components: (f.components || []).map(c => c.name),
        plannedStartDate: f.customfield_10207 || '',
        plannedEndDate: f.customfield_10208 || '',
        created: f.created,
        updated: f.updated,
        url: `${jiraUrl}/browse/${issue.key}`,
      };
    };

    // Execute all queries in parallel for speed
    const results = await Promise.allSettled(
      queries.map(async (q) => {
        try {
          const resp = await client.get('/rest/api/2/search', {
            params: { jql: q.jql, fields: requestedFields, maxResults: 50, startAt: 0 },
          });
          return (resp.data.issues || []).map(mapIssue);
        } catch {
          // Individual query failure (e.g. field not found) is non-fatal
          return [];
        }
      })
    );

    // Merge and deduplicate by issue key
    const seen = new Set();
    const pending = [];
    for (const r of results) {
      const issues = r.status === 'fulfilled' ? r.value : [];
      for (const issue of issues) {
        if (!seen.has(issue.key)) {
          seen.add(issue.key);
          pending.push(issue);
        }
      }
    }

    // Sort by created DESC
    pending.sort((a, b) => (b.created || '').localeCompare(a.created || ''));

    res.apiSuccess({ issues: pending, total: pending.length, scanned: pending.length }, 'Pending approvals fetched');
  } catch (error) {
    res.apiError('Failed to fetch pending approvals', error.response?.status || 500, error.message);
  }
});

// GET /issues/:issueKey/transitions  获取可用操作
router.get('/issues/:issueKey/transitions', requireJiraConfig, async (req, res) => {
  try {
    const client = createJiraClient(req.jiraConfig);
    // Get actual Jira identity from PAT for approver matching
    let jiraUsername = '';
    try {
      const myselfResp = await client.get('/rest/api/2/myself');
      jiraUsername = myselfResp.data?.name || '';
    } catch { /* */ }
    const currentUser = {
      username: jiraUsername || req.user?.username || req.user?.userId || '',
      userId: req.user?.userId || '',
      displayName: req.user?.displayName || '',
      email: req.user?.email || '',
    };
    const transitions = await getTransitions(req.params.issueKey.toUpperCase(), req.jiraConfig, currentUser);
    res.apiSuccess(transitions, 'Transitions fetched');
  } catch (error) {
    res.apiError('Failed to fetch transitions', 500, error.message);
  }
});

// POST /issues/:issueKey/comments  添加评论
router.post('/issues/:issueKey/comments', requireJiraConfig, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) return res.apiError('Comment body is required', 400);
    const result = await addComment(req.params.issueKey.toUpperCase(), body.trim(), req.jiraConfig);
    res.apiSuccess(result, 'Comment added');
  } catch (error) {
    res.apiError('Failed to add comment', 500, error.message);
  }
});

// POST /issues/:issueKey/transition  执行 transition
router.post('/issues/:issueKey/transition', requireJiraConfig, async (req, res) => {
  try {
    const { transitionId, fields = {} } = req.body;
    if (!transitionId) return res.apiError('transitionId is required', 400);
    await doTransition(req.params.issueKey.toUpperCase(), transitionId, fields, req.jiraConfig);
    res.apiSuccess(null, 'Transition executed');
  } catch (error) {
    const errData = error.response?.data;
    const msg = errData?.errorMessages?.[0]
      || (errData?.errors ? JSON.stringify(errData.errors) : error.message);
    res.apiError('Failed to execute transition', 500, msg);
  }
});

// ── User Jira Configuration endpoints ───────────────────────────────────────

// GET /config  获取当前用户的 Jira 配置
router.get('/config', (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.apiError('User not identified', 401);
  const config = getUserConfig(userId);
  if (!config) return res.apiSuccess({ configured: false }, 'No Jira config found');
  // Never return full PAT to frontend - mask it
  const masked = {
    ...config,
    jiraPat: config.jiraPat ? `${'*'.repeat(Math.max(0, config.jiraPat.length - 8))}${config.jiraPat.slice(-8)}` : '',
    configured: true,
  };
  return res.apiSuccess(masked, 'Jira config fetched');
});

// PUT /config  保存/更新当前用户的 Jira 配置
router.put('/config', (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.apiError('User not identified', 401);
  const { jiraUrl, jiraPat, serviceDeskId, requestTypeId } = req.body;
  if (!jiraUrl) {
    return res.apiError('jiraUrl is required', 400);
  }
  // Basic URL validation
  try { new URL(jiraUrl); } catch {
    return res.apiError('Invalid Jira Server URL', 400);
  }
  // If jiraPat is empty, keep existing token (for update without re-entering)
  const existing = getUserConfig(userId);
  const effectivePat = jiraPat || (existing?.jiraPat || '');
  if (!effectivePat) {
    return res.apiError('API Token is required (no existing token found)', 400);
  }
  const saved = setUserConfig(userId, { jiraUrl: jiraUrl.replace(/\/+$/, ''), jiraPat: effectivePat, serviceDeskId, requestTypeId });
  res.apiSuccess({ configured: true, jiraUrl: saved.jiraUrl, updatedAt: saved.updatedAt }, 'Jira config saved');
});

// DELETE /config  删除当前用户的 Jira 配置
router.delete('/config', (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.apiError('User not identified', 401);
  deleteUserConfig(userId);
  res.apiSuccess(null, 'Jira config deleted');
});

// POST /config/test  测试 Jira 连接
router.post('/config/test', async (req, res) => {
  try {
    const { jiraUrl, jiraPat } = req.body;
    if (!jiraUrl || !jiraPat) return res.apiError('jiraUrl and jiraPat are required', 400);
    const testConfig = { jiraUrl: jiraUrl.replace(/\/+$/, ''), jiraPat };
    const client = require('../services/jiraService');
    // Try fetching server info
    const axios = require('axios');
    const https = require('https');
    const testClient = axios.create({
      baseURL: testConfig.jiraUrl,
      headers: { Authorization: `Bearer ${testConfig.jiraPat}`, 'Content-Type': 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000,
    });
    const resp = await testClient.get('/rest/api/2/serverInfo');
    res.apiSuccess({
      serverTitle: resp.data.serverTitle,
      version: resp.data.version,
      baseUrl: resp.data.baseUrl,
    }, 'Connection successful');
  } catch (error) {
    const msg = error.response?.data?.message || error.response?.data?.errorMessages?.[0] || error.message;
    res.apiError('Connection failed', error.response?.status || 500, msg);
  }
});

module.exports = { router };
