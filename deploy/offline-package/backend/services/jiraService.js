const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_JIRA_URL = process.env.JIRA_URL || 'https://jira.gopayinc.com.cn';
const DEFAULT_JIRA_PAT = process.env.JIRA_PAT || '';
const SERVICE_DESK_ID = process.env.JIRA_SERVICE_DESK_ID || '107';
const REQUEST_TYPE_ID = process.env.JIRA_REQUEST_TYPE_ID || '958';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ── Per-user config persistence ─────────────────────────────────────────────
const USER_CONFIGS_FILE = path.join(__dirname, '../config/jiraUserConfigs.json');

function loadUserConfigs() {
  try {
    return JSON.parse(fs.readFileSync(USER_CONFIGS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveUserConfigs(configs) {
  fs.writeFileSync(USER_CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf8');
}

function getUserConfig(userId) {
  const configs = loadUserConfigs();
  return configs[userId] || null;
}

function setUserConfig(userId, config) {
  const configs = loadUserConfigs();
  configs[userId] = {
    jiraUrl: config.jiraUrl || '',
    jiraPat: config.jiraPat || '',
    serviceDeskId: config.serviceDeskId || SERVICE_DESK_ID,
    requestTypeId: config.requestTypeId || REQUEST_TYPE_ID,
    updatedAt: new Date().toISOString(),
  };
  saveUserConfigs(configs);
  return configs[userId];
}

function deleteUserConfig(userId) {
  const configs = loadUserConfigs();
  delete configs[userId];
  saveUserConfigs(configs);
}

// ── Create Jira axios instance (per-user or fallback to env) ────────────────
function createJiraClient(userConfig) {
  const jiraUrl = userConfig?.jiraUrl || DEFAULT_JIRA_URL;
  const jiraPat = userConfig?.jiraPat || DEFAULT_JIRA_PAT;

  return axios.create({
    baseURL: jiraUrl,
    headers: {
      Authorization: `Bearer ${jiraPat}`,
      'Content-Type': 'application/json',
      'X-ExperimentalApi': 'opt-in',
    },
    httpsAgent,
    timeout: 15000,
  });
}

// Legacy global client (used when no userConfig is passed)
const jiraAxios = createJiraClient(null);

function fillTemplate(template, vars = {}, reporter = '') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const builtins = {
    DATE_COMPACT: `${y}${pad(m)}${pad(d)}`,
    DATE_SLASH: `${m}/${d}/${y}`,
    DATE_REPORT: `${pad(m)}/${pad(d)}/${y}`,
    MONTH_COMPACT: `${y}${pad(m)}`,
    MONTH_EN: monthNames[now.getMonth()],
    ntid: reporter || '',  // {ntid} 自动引用 reporter
  };

  const allVars = { ...builtins, ...vars };
  return Object.entries(allVars).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, v),
    template
  );
}

async function createTicket({ reporter, summary, description, componentId, userConfig }) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const sdId = userConfig?.serviceDeskId || SERVICE_DESK_ID;
  const rtId = userConfig?.requestTypeId || REQUEST_TYPE_ID;
  const payload = {
    serviceDeskId: sdId,
    requestTypeId: rtId,
    raiseOnBehalfOf: reporter,
    requestFieldValues: {
      summary,
      description,
      components: [{ id: componentId }],
    },
  };
  const response = await client.post('/rest/servicedeskapi/request', payload);
  return response.data;
}

async function createFullTicket({ reporter, summary, description, assignee, componentId, extraFields, userConfig }) {
  const result = await createTicket({ reporter, summary, description, componentId, userConfig });
  const issueKey = result.issueKey;
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const jiraUrl = userConfig?.jiraUrl || DEFAULT_JIRA_URL;

  let extraFieldsSkipped = false;
  let assigneeSkipped = false;
  const fieldsToUpdate = {};
  if (extraFields && typeof extraFields === 'object') {
    Object.assign(fieldsToUpdate, extraFields);
  }
  const assigneeName = typeof assignee === 'string' ? assignee.trim() : '';
  if (assigneeName) {
    fieldsToUpdate.assignee = { name: assigneeName };
  }

  if (Object.keys(fieldsToUpdate).length > 0) {
    try {
      await client.put(`/rest/api/2/issue/${issueKey}`, { fields: fieldsToUpdate });
    } catch {
      if (extraFields && typeof extraFields === 'object' && Object.keys(extraFields).length > 0) {
        extraFieldsSkipped = true;
      }
      if (assigneeName) {
        assigneeSkipped = true;
      }
    }
  }

  return {
    issueKey,
    issueId: result.issueId,
    url: `${jiraUrl}/browse/${issueKey}`,
    extraFieldsSkipped,
    assigneeSkipped,
  };
}

async function getTicket(issueKey, userConfig) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const jiraUrl = userConfig?.jiraUrl || DEFAULT_JIRA_URL;
  const resp = await client.get(
    `/rest/api/2/issue/${issueKey}?fields=summary,description,status,reporter,assignee,issuetype,components,priority,created,updated,customfield_10207,customfield_10208`
  );
  const f = resp.data.fields;
  return {
    key: resp.data.key,
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
    created: f.created || '',
    updated: f.updated || '',
    url: `${jiraUrl}/browse/${issueKey}`,
  };
}

async function getTransitions(issueKey, userConfig, currentUserName) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const resp = await client.get(
    `/rest/api/2/issue/${issueKey}/transitions?expand=transitions.fields`
  );
  let transitions = (resp.data.transitions || []).map(t => ({
    id: t.id,
    name: t.name,
    toStatus: t.to?.name,
    fields: t.fields || {},
  }));

  const normalizeIdentity = (val) => String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');

  const extractCandidates = (val) => {
    const raw = String(val || '').trim();
    if (!raw) return [];
    const out = [raw];
    if (raw.includes('@')) out.push(raw.split('@')[0]);
    return out;
  };

  // 检查用户是否在 Approvers 中，如果是但没有 approve transition，则添加一个
  if (currentUserName && !transitions.some(t => /^(approve|approved)$/i.test(t.name))) {
    try {
      const issueResp = await client.get(`/rest/api/2/issue/${issueKey}?expand=names`);
      const fields = issueResp.data.fields || {};
      const namesMap = issueResp.data.names || {};
      const approverGroups = [];
      let fallbackUserGroup = null;

      const currentUser = typeof currentUserName === 'object' ? currentUserName : { username: currentUserName };
      const currentIdentityCandidates = [
        ...extractCandidates(currentUser.username),
        ...extractCandidates(currentUser.userId),
        ...extractCandidates(currentUser.displayName),
        ...extractCandidates(currentUser.email),
      ];
      const currentIdentitySet = new Set(currentIdentityCandidates.map(normalizeIdentity).filter(Boolean));
      
      // 搜索所有 customfields，找到用户列表字段
      for (const [key, value] of Object.entries(fields)) {
        if (!key.startsWith('customfield_')) continue;
        if (!Array.isArray(value) || value.length === 0) continue;
        const sample = value[0];
        // 判断是否为用户对象（通常有 displayName 属性）
        if (sample && typeof sample === 'object' && sample.displayName) {
          const fieldName = String(namesMap[key] || '').toLowerCase();
          if (fieldName.includes('approver') || fieldName.includes('approval')) {
            approverGroups.push(value);
          }
          if (!fallbackUserGroup) fallbackUserGroup = value;
        }
      }

      const candidates = approverGroups.length > 0 ? approverGroups : (fallbackUserGroup ? [fallbackUserGroup] : []);
      
      // 检查当前用户是否在 approvers 中
      if (candidates.length > 0 && currentIdentitySet.size > 0) {
        const isApprover = candidates.some((group) => group.some((a) => {
          const approverValues = [
            ...extractCandidates(a.name),
            ...extractCandidates(a.key),
            ...extractCandidates(a.displayName),
            ...extractCandidates(a.emailAddress),
          ];
          return approverValues.some((v) => currentIdentitySet.has(normalizeIdentity(v)));
        }));
        if (isApprover) {
          transitions.push({
            id: 'approve-added',
            name: 'Approved',
            toStatus: 'Approved',
            fields: {},
          });
        }
      }
    } catch (err) {
      // 如果查询失败，忽略，返回原始 transitions
    }
  }

  return transitions;
}

async function addComment(issueKey, body, userConfig) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const resp = await client.post(`/rest/api/2/issue/${issueKey}/comment`, { body });
  return { id: resp.data.id, created: resp.data.created };
}

async function doTransition(issueKey, transitionId, fields = {}, userConfig) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  let realTransitionId = transitionId;
  
  if (transitionId === 'approve-added') {
    // First try standard transitions API
    try {
      const transResp = await client.get(
        `/rest/api/2/issue/${issueKey}/transitions?expand=transitions.fields`
      );
      const allTransitions = transResp.data.transitions || [];
      const approveTransition = allTransitions.find(t =>
        /^(approve|approved)$/i.test(t.name) || t.to?.name === 'Approved'
      );
      if (approveTransition) {
        realTransitionId = approveTransition.id;
      } else {
        // No standard approve transition — try Service Desk Approval API
        const approvalResp = await client.get(
          `/rest/servicedeskapi/request/${issueKey}/approval`
        );
        const pendingApproval = (approvalResp.data?.values || []).find(
          a => a.finalDecision === 'pending' && a.canAnswerApproval
        );
        if (pendingApproval) {
          await client.post(
            `/rest/servicedeskapi/request/${issueKey}/approval/${pendingApproval.id}`,
            { decision: 'approve' }
          );
          return; // Done via Service Desk API
        }
        throw new Error('No approve transition or Service Desk approval found');
      }
    } catch (err) {
      if (err.message && !err.message.includes('No approve')) throw err;
      throw new Error(`Failed to approve: ${err.message}`);
    }
  }
  
  const payload = { transition: { id: realTransitionId } };
  if (Object.keys(fields).length > 0) payload.fields = fields;
  await client.post(`/rest/api/2/issue/${issueKey}/transitions`, payload);
}

async function searchTickets({ issueKey, reporter, assignee, status, dateFrom, dateTo, maxResults = 50, startAt = 0, userConfig } = {}) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const jiraUrl = userConfig?.jiraUrl || DEFAULT_JIRA_URL;
  const jqlParts = [];
  let keyPostFilter = '';

  const addOneDay = (ymd) => {
    const dt = new Date(`${ymd}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return '';
    dt.setDate(dt.getDate() + 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  if (issueKey) {
    const normalized = String(issueKey).toUpperCase().trim();
    const escaped = normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // Full key format: e.g. ISDS-2936
    if (/^[A-Z][A-Z0-9_]+-\d+$/.test(normalized)) {
      jqlParts.push(`key = "${escaped}"`);
    } else {
      // For partial/pure-numeric query, fetch recent candidates first then do local key filter.
      keyPostFilter = normalized;
    }
  }
  if (reporter) {
    jqlParts.push(`reporter = "${String(reporter).replace(/"/g, '\\"')}"`);
  }
  if (assignee) {
    jqlParts.push(`assignee = "${String(assignee).replace(/"/g, '\\"')}"`);
  }
  if (status) {
    jqlParts.push(`status = "${String(status).replace(/"/g, '\\"')}"`);
  }
  if (dateFrom) {
    jqlParts.push(`created >= "${dateFrom}"`);
  }
  if (dateTo) {
    const nextDay = addOneDay(dateTo);
    if (nextDay) {
      // Jira datetime fields with a plain date can behave like midnight boundaries.
      // Use "< next day" to make end date inclusive for the whole selected day.
      jqlParts.push(`created < "${nextDay}"`);
    }
  }

  const jql = `${jqlParts.length > 0 ? jqlParts.join(' AND ') + ' ' : ''}ORDER BY created DESC`;

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

  if (keyPostFilter) {
    // Exact segment search for mixed prefixes (e.g. "2950" -> ISDS-2950/ECSR-2950 only)
    const q = keyPostFilter.toUpperCase();
    const isNumericQuery = /^\d+$/.test(q);
    const pageSize = 500;
    const maxScanIssues = 5000;
    let cursor = 0;
    let total = 0;
    let shouldContinue = true;
    const matched = [];

    while (shouldContinue && cursor < maxScanIssues) {
      const resp = await client.get('/rest/api/2/search', {
        params: {
          jql,
          fields: 'summary,status,reporter,assignee,issuetype,components,created,updated,customfield_10207,customfield_10208',
          maxResults: pageSize,
          startAt: cursor,
        },
      });

      const rawIssues = resp.data.issues || [];
      total = resp.data.total || 0;
      const pageMatches = rawIssues.map(mapIssue)
        .filter((issue) => {
          const key = String(issue.key || '').toUpperCase();
          if (!key) return false;
          if (isNumericQuery) {
            const m = key.match(/^[A-Z][A-Z0-9_]*-(\d+)$/);
            return !!m && m[1] === q;
          }
          return key.includes(q);
        });
      matched.push(...pageMatches);

      cursor += rawIssues.length;
      shouldContinue = rawIssues.length > 0 && cursor < total;
    }

    // Sort by prefix priority: ISDS first, TPX second, CHG/ECSR last
    const ALLOWED_PREFIXES = ['ISDS', 'TPX', 'CHG', 'ECSR'];
    const PREFIX_PRIORITY = { ISDS: 0, TPX: 1, CHG: 2, ECSR: 2 };
    const filtered = isNumericQuery
      ? matched.filter((issue) => {
          const prefix = String(issue.key || '').split('-')[0];
          return ALLOWED_PREFIXES.includes(prefix);
        })
      : matched;
    const sorted = isNumericQuery
      ? filtered.sort((a, b) => {
          const pa = PREFIX_PRIORITY[String(a.key || '').split('-')[0]] ?? 99;
          const pb = PREFIX_PRIORITY[String(b.key || '').split('-')[0]] ?? 99;
          return pa - pb;
        })
      : filtered;

    const paged = sorted.slice(startAt, startAt + maxResults);
    return {
      total: sorted.length,
      startAt,
      maxResults,
      issues: paged,
    };
  }

  const resp = await client.get('/rest/api/2/search', {
    params: {
      jql,
      fields: 'summary,description,status,reporter,assignee,issuetype,components,created,updated,customfield_10207,customfield_10208',
      maxResults,
      startAt,
    },
  });

  const issues = (resp.data.issues || []).map(mapIssue);

  return {
    total: resp.data.total || 0,
    startAt: resp.data.startAt || 0,
    maxResults: resp.data.maxResults || maxResults,
    issues,
  };
}

async function searchUsers(query, userConfig) {
  const q = String(query || '').trim();
  if (!q) return [];

  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;
  const dedup = new Map();

  const mergeUsers = (list) => {
    (list || []).forEach((u) => {
      const name = u?.name || u?.key || '';
      if (!name) return;
      if (!dedup.has(name)) {
        dedup.set(name, {
          name,
          displayName: u?.displayName || name,
          email: u?.emailAddress || '',
          active: u?.active !== false,
        });
      }
    });
  };

  // Jira Server/Data Center and不同版本字段差异，依次兜底。
  const attempts = [
    { url: '/rest/api/2/user/search', params: { username: q, maxResults: 20 } },
    { url: '/rest/api/2/user/search', params: { query: q, maxResults: 20 } },
    { url: '/rest/api/latest/user/search', params: { username: q, maxResults: 20 } },
    { url: '/rest/api/latest/user/search', params: { query: q, maxResults: 20 } },
  ];

  for (const attempt of attempts) {
    try {
      const resp = await client.get(attempt.url, { params: attempt.params });
      if (Array.isArray(resp.data)) mergeUsers(resp.data);
      if (dedup.size >= 10) break;
    } catch {
      // ignore and try next fallback
    }
  }

  return Array.from(dedup.values()).slice(0, 10);
}

const TEMPLATE_HINT_STOPWORDS = new Set([
  'a', 'an', 'and', 'cn', 'compact', 'date', 'day', 'email', 'en', 'floor', 'for',
  'hostname', 'id', 'in', 'month', 'name', 'ntid', 'of', 'on', 'or', 'report',
  'slash', 'the', 'time', 'to', 'user', 'users', 'year'
]);

function normalizeToken(token) {
  const lower = token.toLowerCase();
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith('s') && lower.length > 3 && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

function tokenizeSummary(value) {
  return (value || '')
    .toLowerCase()
    .split(/[\s\-_,./:()]+/)
    .map(normalizeToken)
    .filter(token => token && !TEMPLATE_HINT_STOPWORDS.has(token));
}

function placeholderToHint(name = '') {
  return tokenizeSummary(name).join(' ');
}

// 去掉 summary 中的所有 {变量} 和日期占位符，用于相似度比对
function stripTemplateVars(s) {
  return (s || '')
    .replace(/\{([^}]+)\}/g, (_, name) => {
      const hint = placeholderToHint(name);
      return hint ? ` ${hint} ` : ' ';
    })
    .replace(/\s*-\s*\d{8}$/g, '') // 去掉末尾类似 -20251001 的日期后缀
    .replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}$/g, '') // 去掉 -MM/DD/YYYY
    .replace(/\s*-\s*(?=$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInternalComponent(fields = {}) {
  const optionWithChildField = Object.entries(fields).find(([fieldId, value]) => (
    fieldId.startsWith('customfield_')
    && value
    && typeof value === 'object'
    && value.value
    && value.id
    && (value.child || value.self)
  ));

  if (optionWithChildField) {
    const [fieldId, value] = optionWithChildField;
    return {
      fieldId,
      category: value.value || '',
      subCategory: value.child?.value || '',
      categoryId: value.id || '',
      subCategoryId: value.child?.id || '',
    };
  }

  const legacyCategory = fields.customfield_11401?.value || fields.customfield_11401?.name || '';
  const legacySubCategory = fields.customfield_11402?.value || fields.customfield_11402?.name || '';
  if (legacyCategory) {
    return {
      fieldId: '',
      category: legacyCategory,
      subCategory: legacySubCategory,
      categoryId: '',
      subCategoryId: '',
    };
  }

  return null;
}

// 从已关闭的工单中自动识别 Internal Component（75%+ 相似度，300天内）
// 返回匹配最多的一个 { category, subCategory, categoryId, subCategoryId, fieldId, count }，或 null
async function autoDetectInternalComponent({ summaryTemplate, componentId, userConfig } = {}) {
  try {
    const client = userConfig ? createJiraClient(userConfig) : jiraAxios;

    const cleanTemplate = stripTemplateVars(summaryTemplate);
    if (!cleanTemplate) return null;

    // 近 300 天
    const since300 = new Date(Date.now() - 300 * 24 * 3600 * 1000)
      .toISOString().slice(0, 10);

    const jql = `project = ISDS AND component = "${componentId}" AND status = Closed AND updated >= "${since300}" ORDER BY updated DESC`;
    const resp = await client.get('/rest/api/2/search', {
      params: {
        jql,
        fields: 'summary,customfield_12724,customfield_11401,customfield_11402',
        maxResults: 100,
      }
    });

    const tally = {};
    let totalMatched = 0;

    (resp.data.issues || []).forEach(issue => {
      const cleanIssue = stripTemplateVars(issue.fields.summary || '');
      const similarity = calculateSimilarity(cleanTemplate, cleanIssue);

      if (similarity >= 0.75) {
        const extracted = extractInternalComponent(issue.fields);
        if (extracted?.category) {
          const key = `${extracted.fieldId}|${extracted.categoryId}|${extracted.subCategoryId}|${extracted.category}|${extracted.subCategory}`;
          if (!tally[key]) tally[key] = { ...extracted, count: 0 };
          tally[key].count++;
          totalMatched++;
        }
      }
    });

    if (totalMatched === 0) return null;

    // 取出现频率最高的
    return Object.values(tally).sort((a, b) => b.count - a.count)[0];
  } catch (error) {
    console.error('[autoDetect] Error:', error.message);
    return null;
  }
}

// 计算两个字符串的相似度（Jaccard 词级）
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const words1 = new Set(tokenizeSummary(s1));
  const words2 = new Set(tokenizeSummary(s2));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) { if (words2.has(w)) intersection++; }

  const union = new Set([...words1, ...words2]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  const templateCoverage = intersection / words1.size;
  return Math.max(jaccard, templateCoverage);
}

// 获取某个 Component 下的 Internal Component 可选项（通过查询真实工单的 Close transition fields）
// 返回: { fieldId, options: [{ id, value, children: [{id, value}] }] }
async function getInternalComponentOptions({ componentId, userConfig } = {}) {
  const client = userConfig ? createJiraClient(userConfig) : jiraAxios;

  // 搜一个近期该 component 的已关闭工单
  const jql = `project = ISDS AND component = "${componentId}" AND status = Closed ORDER BY updated DESC`;
  const search = await client.get('/rest/api/2/search', {
    params: { jql, fields: 'summary', maxResults: 1 }
  });

  const issues = search.data.issues || [];
  if (issues.length === 0) return null;

  const issueKey = issues[0].key;

  // 获取该工单的 transitions（包含字段元数据）
  const transResp = await client.get(
    `/rest/api/2/issue/${issueKey}/transitions?expand=transitions.fields`
  );
  const transitions = transResp.data.transitions || [];

  // 找 Close transition
  const closeTrans = transitions.find(t =>
    /close/i.test(t.name) || /close/i.test(t.to?.name || '')
  ) || transitions.find(t => /done/i.test(t.name));

  if (!closeTrans) return null;

  // 找 option-with-child 字段
  for (const [fieldId, fieldDef] of Object.entries(closeTrans.fields || {})) {
    if (fieldDef.schema?.type === 'option-with-child') {
      return {
        fieldId,
        fieldName: fieldDef.name || 'Internal Component',
        options: (fieldDef.allowedValues || []).map(o => ({
          id: o.id,
          value: o.value,
          children: (o.children || []).map(c => ({ id: c.id, value: c.value })),
        })),
      };
    }
  }
  return null;
}

module.exports = {
  createJiraClient,
  fillTemplate, createFullTicket, getTicket, getTransitions, addComment, doTransition, searchTickets, searchUsers,
  autoDetectInternalComponent, getInternalComponentOptions,
  getUserConfig, setUserConfig, deleteUserConfig,
};
