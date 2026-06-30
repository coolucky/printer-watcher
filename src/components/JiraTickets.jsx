import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, TextField, Button,
  Select, MenuItem, FormControl, InputLabel, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, CircularProgress, Link, Tooltip, Divider, LinearProgress,
  Autocomplete, Popper, Collapse, Popover,
  Switch, FormControlLabel,
} from '@mui/material';
import {
  Add, Edit, Delete, Send, ConfirmationNumber, Search, Comment, CheckCircle, Settings,
  ContentCopy, Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

// ── Auth helper (same pattern as UserManagement) ──────────────────────────────
const getToken = () => {
  try {
    const session = JSON.parse(localStorage.getItem('authSession'));
    return session?.accessToken || null;
  } catch {
    return null;
  }
};

const getCurrentUsername = () => {
  try {
    const session = JSON.parse(localStorage.getItem('authSession'));
    if (session?.user?.username) return session.user.username;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return currentUser?.username || '';
  } catch {
    return '';
  }
};

const getCurrentNtid = () => {
  try {
    const session = JSON.parse(localStorage.getItem('authSession') || 'null');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

    const email = session?.user?.email
      || session?.user?.mail
      || currentUser?.email
      || currentUser?.mail
      || '';
    if (email && email.includes('@')) {
      return email.split('@')[0].trim().toLowerCase();
    }

    const username = session?.user?.username
      || currentUser?.username
      || getCurrentUsername()
      || '';
    return String(username).trim().toLowerCase();
  } catch {
    return '';
  }
};

const authHeader = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const API = '/api/jira';

// ── Recent NTIDs persistence (localStorage) ───────────────────────────────────
const RECENT_REPORTERS_KEY = 'jira_recent_reporters';
const RECENT_ASSIGNEES_KEY = 'jira_recent_assignees';
const RECENT_TICKET_SEARCHES_KEY = 'jira_recent_ticket_searches';
const RECENT_OPENED_TICKETS_KEY = 'jira_recent_opened_tickets';
const ISSUE_TEMPLATE_BINDINGS_KEY = 'jira_issue_template_bindings';
const TEMPLATE_USAGE_KEY = 'jira_template_usage';
const COMMENT_TEMPLATES_KEY = 'jira_comment_templates';
const MAX_RECENT = 5;
const MAX_RECENT_TICKETS = 20;

const getRecentNtids = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]').slice(0, MAX_RECENT); }
  catch { return []; }
};

const addRecentNtid = (key, ntid) => {
  if (!ntid || !ntid.trim()) return;
  const val = ntid.trim();
  const list = getRecentNtids(key).filter(x => x !== val);
  list.unshift(val);
  localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_RECENT)));
};

const getRecentTickets = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_OPENED_TICKETS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => t && t.key).slice(0, MAX_RECENT_TICKETS);
  } catch {
    return [];
  }
};

const saveRecentTickets = (tickets) => {
  localStorage.setItem(
    RECENT_OPENED_TICKETS_KEY,
    JSON.stringify((tickets || []).slice(0, MAX_RECENT_TICKETS))
  );
};

const getIssueTemplateBindings = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ISSUE_TEMPLATE_BINDINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const saveIssueTemplateBindings = (bindings) => {
  localStorage.setItem(ISSUE_TEMPLATE_BINDINGS_KEY, JSON.stringify(bindings || {}));
};

// Template usage tracking for frequency sorting and "recently used" section
const getTemplateUsage = () => {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_USAGE_KEY) || '{}'); } catch { return {}; }
};
const recordTemplateUsage = (templateId) => {
  if (!templateId) return;
  const usage = getTemplateUsage();
  usage[templateId] = (usage[templateId] || 0) + 1;
  localStorage.setItem(TEMPLATE_USAGE_KEY, JSON.stringify(usage));
};
const getRecentTemplateIds = () => {
  try { return JSON.parse(localStorage.getItem('jira_recent_template_ids') || '[]').slice(0, 5); } catch { return []; }
};
const addRecentTemplateId = (id) => {
  if (!id) return;
  const list = getRecentTemplateIds().filter(x => x !== id);
  list.unshift(id);
  localStorage.setItem('jira_recent_template_ids', JSON.stringify(list.slice(0, 5)));
};

// Comment templates persistence (backend-shared)
const getCommentTemplates = () => [];
const saveCommentTemplates = () => {};

// ── User Autocomplete sub-component ──────────────────────────────────────────
let searchTimer = null;
const AUTOCOMPLETE_VISIBLE_COUNT = 3;
const AUTOCOMPLETE_ROW_HEIGHT = 52;

function FixedBottomPopper(props) {
  return (
    <Popper
      {...props}
      placement="bottom-start"
      modifiers={[
        { name: 'flip', enabled: false },
        { name: 'preventOverflow', enabled: true, options: { altAxis: false, tether: true } },
      ]}
    />
  );
}

function UserAutocomplete({
  value,
  onChange,
  label,
  placeholder,
  size = 'medium',
  sx = {},
  onEnter,
  recentKey = RECENT_REPORTERS_KEY,
}) {
  const [inputValue, setInputValue] = React.useState(value || '');
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { setInputValue(value || ''); }, [value]);

  const fetchUsers = React.useCallback((query) => {
    if (!query || query.length < 1) { setOptions([]); return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/users/search`, {
          headers: authHeader(), params: { q: query },
        });
        if (data.success) {
          const recent = getRecentNtids(recentKey);
          // Merge recent + API results, deduplicate
          const apiUsers = (data.data || []).map(u => ({
            name: u.name, displayName: u.displayName, email: u.email,
          }));
          const recentUsers = recent
            .filter(r => r.toLowerCase().includes(query.toLowerCase()))
            .map(r => ({ name: r, displayName: '', email: '', isRecent: true }));
          const merged = [...recentUsers, ...apiUsers.filter(u => !recent.includes(u.name))];
          setOptions(merged.slice(0, 10));
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
  }, []);

  return (
    <Autocomplete
      freeSolo
      PopperComponent={FixedBottomPopper}
      size={size}
      options={options}
      loading={loading}
      ListboxProps={{
        style: {
          maxHeight: AUTOCOMPLETE_VISIBLE_COUNT * AUTOCOMPLETE_ROW_HEIGHT,
          overflowY: 'auto',
        },
      }}
      onOpen={() => {
        if (inputValue && inputValue.trim()) fetchUsers(inputValue.trim());
      }}
      inputValue={inputValue}
      onInputChange={(_, val, reason) => {
        setInputValue(val);
        if (reason === 'input') fetchUsers(val);
        if (reason === 'clear') { onChange(''); setOptions([]); }
      }}
      onChange={(_, val) => {
        if (typeof val === 'string') onChange(val);
        else if (val?.name) onChange(val.name);
      }}
      onBlur={() => onChange(inputValue)}
      getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
      renderOption={(props, opt) => (
        <li {...props} key={opt.name} style={{ ...props.style, padding: '4px 12px' }}>
          <Box sx={{ lineHeight: 1.3 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.83rem' }}>
              {opt.displayName || opt.name}
              {opt.isRecent && <Chip label="recent" size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem' }} />}
            </Typography>
            {opt.email && (
              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {opt.email}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder}
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter) {
              e.preventDefault();
              onChange(inputValue);
              onEnter(inputValue);
            }
          }}
          InputProps={{ ...params.InputProps, endAdornment: (
            <>{loading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>
          )}} />
      )}
      sx={sx}
    />
  );
}

// ── Static maps ───────────────────────────────────────────────────────────────
const COMPONENT_NAMES = {
  '12492': 'AV/VC Operation',
  '12493': 'AV/VC Support',
  '12494': 'AVAYA Operation',
  '12495': 'AVAYA Support',
  '12497': 'Citrix',
  '12498': 'Mobile Support',
  '12499': 'Desktop/Laptop Request & Issue',
  '12500': 'IT Procurement',
  '12501': 'Asset',
  '12502': 'Messaging & Collaboration',
  '12503': 'Server Hosting',
  '12504': 'MDM',
  '12505': 'AD',
  '12506': 'SCCM',
  '12507': 'On/Off Boarding',
  '12496': 'Printer',
};

const EMPTY_TEMPLATE = {
  name: '', category: 'custom', componentId: '12499',
  summaryTemplate: '', descriptionTemplate: '', inputs: [], extraFields: null,
  internalComponentCategory: '',
  internalComponentSubCategory: '',
  internalComponentCategoryId: '',
  internalComponentSubCategoryId: '',
  internalComponentFieldId: '',
};

// ── Sub-tab shared styles ─────────────────────────────────────────────────────
const subTabSx = {
  '& .MuiTabs-indicator': { backgroundColor: 'var(--primary-color)' },
  '& .MuiTab-root': {
    color: 'var(--text-secondary)',
    textTransform: 'none',
    fontSize: '0.875rem',
    minWidth: 'auto',
    '&:hover': { color: 'var(--text-primary)' },
    '&.Mui-selected': { color: 'var(--primary-color)', fontWeight: 600 },
  },
  borderBottom: '1px solid var(--border-color)',
  mb: 3,
};

// ── Status chip color ─────────────────────────────────────────────────────────
const statusColor = (cat) => {
  if (cat === 'green') return 'success';
  if (cat === 'yellow') return 'warning';
  if (cat === 'blue-grey') return 'default';
  return 'primary';
};

// ── Jira wiki description renderer ───────────────────────────────────────────
const HAS_TABLE_RE = new RegExp('^\\|.+\\|$', 'm');

function parseJiraCells(line) {
  // Strip leading/trailing | then split
  const stripped = line.replace(/^\|+/, '').replace(/\|+$/, '');
  return stripped.split('|').map(c => c.trim());
}

function renderJiraDescription(text, expanded) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let tableLines = [];
  let textLines = [];

  const flushText = () => {
    if (textLines.length > 0) {
      blocks.push({ type: 'text', content: textLines.join('\n') });
      textLines = [];
    }
  };
  const flushTable = () => {
    if (tableLines.length > 0) {
      blocks.push({ type: 'table', lines: [...tableLines] });
      tableLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\|.+\|$/.test(trimmed)) {
      flushText();
      tableLines.push(trimmed);
    } else {
      flushTable();
      textLines.push(line);
    }
  }
  flushText();
  flushTable();

  // Collapse: show only first 2 text-lines worth (skip full tables)
  if (!expanded) {
    const firstTextBlock = blocks.find(b => b.type === 'text');
    const preview = firstTextBlock
      ? firstTextBlock.content.split('\n').filter(l => l.trim()).slice(0, 2).join('\n')
      : '';
    return (
      <Typography variant="body2" component="pre" sx={{
        color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.6, m: 0,
      }}>
        {preview}
      </Typography>
    );
  }

  return (
    <Box>
      {blocks.map((block, bi) => {
        if (block.type === 'text') {
          const content = block.content.replace(/^\n+|\n+$/g, '');
          if (!content) return null;
          return (
            <Typography key={bi} variant="body2" component="pre" sx={{
              color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.6, m: 0, mb: 1,
            }}>
              {content}
            </Typography>
          );
        }
        // Table block
        const tableRows = block.lines.map(l => {
          const isHeader = l.startsWith('||');
          const cells = parseJiraCells(l);
          return { isHeader, cells };
        });
        const maxCols = Math.max(...tableRows.map(r => r.cells.length));
        return (
          <Box key={bi} sx={{ overflowX: 'auto', mb: 1.5 }}>
            <Table size="small" sx={{
              '& td, & th': {
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                py: 0.5,
                px: 1,
                color: 'var(--text-primary)',
              },
              '& th': { backgroundColor: 'var(--background-secondary)', fontWeight: 600 },
            }}>
              <TableBody>
                {tableRows.map((row, ri) => (
                  <TableRow key={ri}>
                    {Array.from({ length: maxCols }).map((_, ci) => {
                      const cell = row.cells[ci] ?? '';
                      return row.isHeader
                        ? <TableCell key={ci} component="th" scope="col">{cell}</TableCell>
                        : <TableCell key={ci}>{cell}</TableCell>;
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        );
      })}
    </Box>
  );
}

function formatJiraDateTime(value) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JiraTickets() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState(0);

  const getCategoryLabel = (category) => t(`jiraTickets.categories.${category}`, category);

  // ── Create Ticket state ───────────────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [varValues, setVarValues] = useState({});
  const [customSummary, setCustomSummary] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [reporterInput, setReporterInput] = useState('');
  const [reporters, setReporters] = useState([]);
  const [reporterOptions, setReporterOptions] = useState([]);
  const [reporterLoading, setReporterLoading] = useState(false);
  const [currentUserNtid] = useState(() => getCurrentNtid());
  const [assigneeInput, setAssigneeInput] = useState(() => getCurrentNtid());
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState([]);
  const [recentReporters, setRecentReporters] = useState(getRecentNtids(RECENT_REPORTERS_KEY));
  const [recentAssignees, setRecentAssignees] = useState(getRecentNtids(RECENT_ASSIGNEES_KEY));
  const [recentOpenedTickets, setRecentOpenedTickets] = useState(getRecentTickets());

  // ── Template Manager state ────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState(EMPTY_TEMPLATE);
  const [inputsJson, setInputsJson] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // (auto-detect runs in background, no UI state needed)
  const [internalComponentOptions, setInternalComponentOptions] = useState(null); // { fieldId, options: [{id,value,children}] }

  // ── Manage Tickets state ──────────────────────────────────────────────────
  const [searchKey, setSearchKey] = useState('');
  const [recentTicketSearches, setRecentTicketSearches] = useState(getRecentNtids(RECENT_TICKET_SEARCHES_KEY));
  const [searchReporter, setSearchReporter] = useState('');
  const [searchAssignee, setSearchAssignee] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchDateFrom, setSearchDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [searchDateTo, setSearchDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [issueTemplateBindings, setIssueTemplateBindings] = useState(getIssueTemplateBindings());
  const [ticketInfo, setTicketInfo] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [descExpanded, setDescExpanded] = useState(false);

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState('');
  const [commentTemplates, setCommentTemplates] = useState(getCommentTemplates());
  const [commentTplAnchor, setCommentTplAnchor] = useState(null);
  const [commentTplEditing, setCommentTplEditing] = useState(false);
  const [commentTplInput, setCommentTplInput] = useState('');

  const [transitionOpen, setTransitionOpen] = useState(false);
  const [activeTransition, setActiveTransition] = useState(null);
  const [transitionFields, setTransitionFields] = useState({});
  const [transitionSaving, setTransitionSaving] = useState(false);
  const [transitionResult, setTransitionResult] = useState(null);
  const recentRefreshTimerRef = React.useRef(null);

  // ── Pending-approval monitor state ───────────────────────────────────────
  const [approvalMonitorOn, setApprovalMonitorOn] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const approvalTimerRef = React.useRef(null);
  const pendingInitializedRef = React.useRef(false);
  const audioContextRef = React.useRef(null);

  // ── Config state ──────────────────────────────────────────────────────────
  const [jiraConfigured, setJiraConfigured] = useState(null); // null = loading, true/false
  const [configData, setConfigData] = useState({ jiraUrl: '', jiraPat: '', serviceDeskId: '', requestTypeId: '' });
  const [configSaving, setConfigSaving] = useState(false);
  const [configTesting, setConfigTesting] = useState(false);
  const [configMsg, setConfigMsg] = useState(null); // { type: 'success'|'error', text }

  const normalizeRecentTicket = useCallback((ticket) => {
    if (!ticket?.key) return null;
    return {
      key: ticket.key,
      templateId: ticket.templateId || '',
      summary: ticket.summary || '',
      description: ticket.description || '',
      status: ticket.status || '',
      statusCategory: ticket.statusCategory || '',
      reporter: ticket.reporter || '',
      assignee: ticket.assignee || '',
      issuetype: ticket.issuetype || '',
      components: Array.isArray(ticket.components) ? ticket.components : [],
      plannedStartDate: ticket.plannedStartDate || '',
      plannedEndDate: ticket.plannedEndDate || '',
      created: ticket.created || '',
      updated: ticket.updated || '',
      url: ticket.url || '',
    };
  }, []);

  const rememberRecentTicket = useCallback((ticket) => {
    const normalized = normalizeRecentTicket(ticket);
    if (!normalized) return;
    // Save issue → template binding to localStorage
    if (normalized.key && normalized.templateId) {
      setIssueTemplateBindings(prev => {
        const updated = { ...prev, [normalized.key]: normalized.templateId };
        saveIssueTemplateBindings(updated);
        return updated;
      });
    }
    setRecentOpenedTickets((prev) => {
      const existing = prev.find(t => t.key === normalized.key);
      const merged = {
        ...existing,
        ...normalized,
        templateId: normalized.templateId || existing?.templateId || '',
      };
      const list = [merged, ...prev.filter(t => t.key !== normalized.key)].slice(0, MAX_RECENT_TICKETS);
      saveRecentTickets(list);
      return list;
    });
  }, [normalizeRecentTicket]);

  useEffect(() => { fetchJiraConfig(); fetchTemplates(); fetchCommentTemplates(); }, []);

  const fetchCommentTemplates = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/comment-templates`, { headers: authHeader() });
      if (data.success) setCommentTemplates(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!assigneeInput && currentUserNtid) {
      setAssigneeInput(currentUserNtid);
    }
  }, [assigneeInput, currentUserNtid]);

  useEffect(() => () => {
    if (recentRefreshTimerRef.current) {
      clearTimeout(recentRefreshTimerRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (approvalTimerRef.current) clearInterval(approvalTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (audioContextRef.current && typeof audioContextRef.current.close === 'function') {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const fetchJiraConfig = async () => {
    try {
      const { data } = await axios.get(`${API}/config`, { headers: authHeader() });
      if (data.success) {
        const cfg = data.data;
        setJiraConfigured(!!cfg.configured);
        if (cfg.configured) {
          setConfigData({ jiraUrl: cfg.jiraUrl || '', jiraPat: '', serviceDeskId: cfg.serviceDeskId || '', requestTypeId: cfg.requestTypeId || '' });
        }
      }
    } catch { setJiraConfigured(false); }
  };

  const handleSaveConfig = async () => {
    if (!configData.jiraUrl || !configData.jiraPat) {
      setConfigMsg({ type: 'error', text: t('jiraTickets.config.urlAndPatRequired') });
      return;
    }
    setConfigSaving(true); setConfigMsg(null);
    try {
      await axios.put(`${API}/config`, configData, { headers: authHeader() });
      setConfigMsg({ type: 'success', text: t('jiraTickets.config.saved') });
      setJiraConfigured(true);
    } catch (e) {
      setConfigMsg({ type: 'error', text: e.response?.data?.message || e.message });
    } finally { setConfigSaving(false); }
  };

  const handleTestConfig = async () => {
    if (!configData.jiraUrl || !configData.jiraPat) {
      setConfigMsg({ type: 'error', text: t('jiraTickets.config.urlAndPatRequired') });
      return;
    }
    setConfigTesting(true); setConfigMsg(null);
    try {
      const { data } = await axios.post(`${API}/config/test`, { jiraUrl: configData.jiraUrl, jiraPat: configData.jiraPat }, { headers: authHeader() });
      if (data.success) {
        setConfigMsg({ type: 'success', text: `${t('jiraTickets.config.testSuccess')} - ${data.data.serverTitle} v${data.data.version}` });
      }
    } catch (e) {
      setConfigMsg({ type: 'error', text: `${t('jiraTickets.config.testFailed')}: ${e.response?.data?.details || e.response?.data?.message || e.message}` });
    } finally { setConfigTesting(false); }
  };

  const handleDeleteConfig = async () => {
    try {
      await axios.delete(`${API}/config`, { headers: authHeader() });
      setJiraConfigured(false);
      setConfigData({ jiraUrl: '', jiraPat: '', serviceDeskId: '', requestTypeId: '' });
      setConfigMsg({ type: 'success', text: t('jiraTickets.config.deleted') });
    } catch (e) {
      setConfigMsg({ type: 'error', text: e.response?.data?.message || e.message });
    }
  };

  // ── API helpers ───────────────────────────────────────────────────────────
  const fetchTemplates = async () => {
    try {
      const { data } = await axios.get(`${API}/templates`, { headers: authHeader() });
      if (data.success) {
        setTemplates(data.data);
        if (data.data.length > 0 && !selectedId) {
          setSelectedId(data.data[0].id);
          setCustomSummary(data.data[0].summaryTemplate || '');
          setCustomDescription(data.data[0].descriptionTemplate || '');
        }
        // 如果有尚无 Internal Component 的模板，在后台触发批量检测
        const hasUndetected = data.data.some(t =>
          t.summaryTemplate && t.componentId && !t.internalComponentCategoryId && !t.internalComponentCategory
        );
        if (hasUndetected) {
          axios.post(`${API}/templates/batch-detect-internal-component`, {}, { headers: authHeader() })
            .catch(() => {}); // 异步调用，忽略错误
        }
      }
    } catch (e) { console.error('fetchTemplates', e); }
  };

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const findTemplateById = useCallback((id) => templates.find(t => t.id === id), [templates]);

  const ensurePendingAudioContext = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  }, []);

  const playPendingNotification = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const notes = [
        { freq: 660, start: 0.00, dur: 0.10 },
        { freq: 880, start: 0.12, dur: 0.12 },
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        gain.gain.setValueAtTime(0.0001, now + note.start);
        gain.gain.exponentialRampToValueAtTime(0.045, now + note.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.dur + 0.02);
      });
    } catch {
      // Ignore audio failures to avoid impacting monitor refresh.
    }
  }, []);

  // ── Pending-approval fetch & polling ──────────────────────────────────────
  const fetchPendingApprovals = useCallback(async () => {
    setPendingLoading(true); setPendingError('');
    try {
      const { data } = await axios.get(`${API}/pending-approvals`, {
        headers: authHeader(),
        params: {
          dateFrom: searchDateFrom || undefined,
          dateTo: searchDateTo || undefined,
          maxScan: 80,
        },
      });
      if (data.success) {
        const nextIssues = data.data?.issues || [];
        setPendingApprovals((prev) => {
          const prevKeys = new Set((prev || []).map(i => i.key));
          const added = nextIssues.filter(i => i?.key && !prevKeys.has(i.key));

          if (!pendingInitializedRef.current) {
            pendingInitializedRef.current = true;
            if (approvalMonitorOn && nextIssues.length > 0) {
              playPendingNotification();
            }
          } else if (approvalMonitorOn && added.length > 0) {
            playPendingNotification();
          }

          return nextIssues;
        });
      }
    } catch (e) {
      setPendingError(e.response?.data?.message || e.message || '获取失败');
    } finally {
      setPendingLoading(false);
    }
  }, [searchDateFrom, searchDateTo, approvalMonitorOn, playPendingNotification]);

  useEffect(() => {
    if (approvalTimerRef.current) clearInterval(approvalTimerRef.current);
    if (!approvalMonitorOn || jiraConfigured !== true) return;
    pendingInitializedRef.current = false;
    fetchPendingApprovals();
    approvalTimerRef.current = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(approvalTimerRef.current);
  }, [approvalMonitorOn, jiraConfigured, fetchPendingApprovals]);

  const fetchRecentOpenedTicketsByAssignee = useCallback(async (assigneeOverride = '') => {
    const ntid = String(assigneeOverride || assigneeInput || currentUserNtid || '').trim();
    if (!ntid) return;

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);

    try {
      const { data } = await axios.get(`${API}/issues`, {
        headers: authHeader(),
        params: {
          assignee: ntid,
          dateFrom: dateFrom.toISOString().slice(0, 10),
          dateTo: dateTo.toISOString().slice(0, 10),
          maxResults: MAX_RECENT_TICKETS,
          startAt: 0,
        },
      });

      if (data.success) {
        const issues = (data.data?.issues || []).map((issue) => (
          normalizeRecentTicket({
            ...issue,
            templateId: issueTemplateBindings[issue.key] || issue.templateId || '',
          })
        )).filter(Boolean);
        setRecentOpenedTickets(issues);
        saveRecentTickets(issues);
      }
    } catch {
      // Keep previous local list if online fetch fails.
    }
  }, [assigneeInput, currentUserNtid, issueTemplateBindings, normalizeRecentTicket]);

  useEffect(() => {
    if (jiraConfigured !== true) return;
    fetchRecentOpenedTicketsByAssignee(currentUserNtid || assigneeInput);
  }, [jiraConfigured, currentUserNtid, fetchRecentOpenedTicketsByAssignee]);

  // ── Create Ticket handlers ────────────────────────────────────────────────
  const addReporter = React.useCallback((raw) => {
    const val = (raw || '').trim().replace(/,$/, '');
    if (!val) return;
    setReporters(prev => [...new Set([...prev, val])]);
    setReporterInput('');
  }, []);

  const fetchReporterUsers = React.useCallback((query) => {
    if (!query || query.length < 1) { setReporterOptions([]); return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      setReporterLoading(true);
      try {
        const { data } = await axios.get(`${API}/users/search`, {
          headers: authHeader(), params: { q: query },
        });
        if (data.success) {
          const recent = getRecentNtids(RECENT_REPORTERS_KEY);
          const apiUsers = (data.data || []).map(u => ({
            name: u.name, displayName: u.displayName, email: u.email,
          }));
          const recentUsers = recent
            .filter(r => r.toLowerCase().includes(query.toLowerCase()))
            .map(r => ({ name: r, displayName: '', email: '', isRecent: true }));
          const merged = [...recentUsers, ...apiUsers.filter(u => !recent.includes(u.name))];
          setReporterOptions(merged.slice(0, 10));
        }
      } catch { /* ignore */ }
      finally { setReporterLoading(false); }
    }, 300);
  }, []);

  const handleCreate = async () => {
    if (!selectedTemplate || reporters.length === 0) return;
    setCreating(true); setResults([]);
    // Save recent NTIDs
    reporters.forEach(r => addRecentNtid(RECENT_REPORTERS_KEY, r));
    setRecentReporters(getRecentNtids(RECENT_REPORTERS_KEY));
    const assigneeToCreate = String(assigneeInput || currentUserNtid || '').trim();
    if (assigneeToCreate) {
      addRecentNtid(RECENT_ASSIGNEES_KEY, assigneeToCreate);
      setRecentAssignees(getRecentNtids(RECENT_ASSIGNEES_KEY));
    }
    try {
      const { data } = await axios.post(`${API}/tickets`, {
        templateId: selectedId, reporters,
        assignee: assigneeToCreate || undefined,
        customSummary: customSummary || undefined,
        customDescription: customDescription || undefined,
        vars: varValues,
      }, { headers: authHeader() });
      if (data.success) {
        const createdRows = (data.data || []).map(r => ({ ...r, templateId: selectedId }));
        setResults(createdRows);
        setCreating(false); // Show results immediately

        // Fetch details in background (non-blocking)
        const successRows = createdRows.filter(r => r.success && r.issueKey);
        if (successRows.length > 0) {
          Promise.all(successRows.map(async (r) => {
            try {
              const detailResp = await axios.get(`${API}/issues/${r.issueKey}`, { headers: authHeader() });
              if (detailResp.data.success) return { ...detailResp.data.data, templateId: r.templateId || selectedId };
            } catch {
              // ignore and fallback to minimum info
            }
            return {
              key: r.issueKey,
              templateId: r.templateId || selectedId,
              reporter: r.reporter,
              summary: '',
              status: '',
              url: r.url || '',
            };
          })).then(details => {
            details.forEach(rememberRecentTicket);
            // Refresh recent tickets list after details are fetched
            fetchRecentOpenedTicketsByAssignee(assigneeToCreate);
          });
        }

        if (recentRefreshTimerRef.current) {
          clearTimeout(recentRefreshTimerRef.current);
        }
        recentRefreshTimerRef.current = setTimeout(() => {
          fetchRecentOpenedTicketsByAssignee(assigneeToCreate);
        }, 2000);
      }
    } catch (e) {
      setResults([{ reporter: '(all)', success: false, error: e.response?.data?.message || e.message }]);
      setCreating(false);
    }
  };

  // ── Quick action handlers (from creation results) ──────────────────────────
  const handleQuickResolve = async (issueKey) => {
    try {
      const transRes = await axios.get(`${API}/issues/${issueKey}/transitions`, { headers: authHeader() });
      if (!transRes.data.success) return;
      const trans = transRes.data.data;
      const resolveTrans = trans.find(t =>
        /resolve/i.test(t.name) || /resolve/i.test(t.toStatus || '')
      );
      if (resolveTrans) {
        setTicketInfo({ key: issueKey });
        setActiveTransition(resolveTrans);
        setTransitionFields({});
        setTransitionResult(null);
        setTransitionOpen(true);
      } else {
        alert(t('jiraTickets.create.noResolveAction'));
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleQuickClose = async (issueKey) => {
    try {
      const transRes = await axios.get(`${API}/issues/${issueKey}/transitions`, { headers: authHeader() });
      if (!transRes.data.success) return;
      const trans = transRes.data.data;
      const closeTrans = trans.find(t =>
        /close/i.test(t.name) || /close/i.test(t.toStatus || '')
      );
      if (!closeTrans) {
        // Fallback: try done
        const doneTrans = trans.find(t => /done/i.test(t.name) || /done/i.test(t.toStatus || ''));
        if (doneTrans) {
          setTicketInfo({ key: issueKey });
          setActiveTransition(doneTrans);
          setTransitionFields({});
          setTransitionResult(null);
          setTransitionOpen(true);
        } else {
          alert(t('jiraTickets.create.noCloseAction'));
        }
        return;
      }

      // Pre-fill Internal Component from template saved values first, then fallback by component name heuristics.
      const candidateTemplateId = results.find(r => r.issueKey === issueKey)?.templateId || selectedId;
      const templateForClose = findTemplateById(candidateTemplateId);
      const componentName = templateForClose ? (COMPONENT_NAMES[templateForClose.componentId] || '') : '';
      const prefilledFields = {};
      if (componentName && closeTrans.fields) {
        for (const [fieldId, fieldDef] of Object.entries(closeTrans.fields)) {
          if (fieldDef.schema?.type === 'option-with-child') {
            const parentOpts = fieldDef.allowedValues || [];
            const targetCategoryId = templateForClose?.internalComponentCategoryId || '';
            const targetCategory = (templateForClose?.internalComponentCategory || '').toLowerCase();
            const targetSubCategoryId = templateForClose?.internalComponentSubCategoryId || '';
            const targetSubCategory = (templateForClose?.internalComponentSubCategory || '').toLowerCase();

            let matched = null;
            if (targetCategoryId) {
              matched = parentOpts.find(o => o.id === targetCategoryId) || null;
            }
            if (!matched && targetCategory) {
              matched = parentOpts.find(o => (o.value || '').toLowerCase() === targetCategory)
                || parentOpts.find(o => (o.value || '').toLowerCase().includes(targetCategory));
            }
            if (!matched) {
              matched = parentOpts.find(o =>
                o.value && componentName.toLowerCase().startsWith(o.value.toLowerCase())
              );
            }

            if (matched) {
              prefilledFields[fieldId] = { id: matched.id };
              // Try to match child (sub-category)
              if (matched.children && matched.children.length > 0) {
                let childMatch = null;
                if (targetSubCategoryId) {
                  childMatch = matched.children.find(c => c.id === targetSubCategoryId) || null;
                }
                if (!childMatch && targetSubCategory) {
                  childMatch = matched.children.find(c => (c.value || '').toLowerCase() === targetSubCategory)
                    || matched.children.find(c => (c.value || '').toLowerCase().includes(targetSubCategory));
                }
                if (!childMatch) {
                  childMatch = matched.children.find(c =>
                    componentName.toLowerCase().includes((c.value || '').toLowerCase())
                  );
                }
                if (childMatch) {
                  prefilledFields[fieldId] = { id: matched.id, child: { id: childMatch.id } };
                }
              }

              // Use first option-with-child field as target
              break;
            }
          }
        }
      }

      setTicketInfo({ key: issueKey, templateId: candidateTemplateId });
      setActiveTransition(closeTrans);
      setTransitionFields(prefilledFields);
      setTransitionResult(null);
      setTransitionOpen(true);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  // 加载某个 componentId 对应的 Internal Component 下拉选项
  const loadInternalComponentOptions = async (componentId) => {
    if (!componentId) { setInternalComponentOptions(null); return; }
    try {
      const { data } = await axios.get(`${API}/internal-component-options`, {
        params: { componentId }, headers: authHeader()
      });
      setInternalComponentOptions(data.success && data.data ? data.data : null);
    } catch {
      setInternalComponentOptions(null);
    }
  };

  // ── Template Manager handlers ─────────────────────────────────────────────
  const openAdd = () => {
    setEditingTemplate(null); setFormData(EMPTY_TEMPLATE); setInputsJson('[]');
    setDialogOpen(true);
    loadInternalComponentOptions(EMPTY_TEMPLATE.componentId);
  };
  const openEdit = (t) => {
    setEditingTemplate(t); setFormData({ ...t });
    setInputsJson(JSON.stringify(t.inputs || [], null, 2));
    setDialogOpen(true);
    loadInternalComponentOptions(t.componentId);
  };
  const openClone = (t) => {
    setEditingTemplate(null);
    setFormData({ ...t, name: `${t.name} (copy)`, id: undefined });
    setInputsJson(JSON.stringify(t.inputs || [], null, 2));
    setDialogOpen(true);
    loadInternalComponentOptions(t.componentId);
  };
  const handleSaveTemplate = async () => {
    let inputs = [];
    try { inputs = JSON.parse(inputsJson); } catch { return alert(t('jiraTickets.alerts.inputsJsonInvalid')); }
    setSaving(true);
    try {
      const payload = { ...formData, inputs };
      if (editingTemplate) await axios.put(`${API}/templates/${editingTemplate.id}`, payload, { headers: authHeader() });
      else await axios.post(`${API}/templates`, payload, { headers: authHeader() });
      await fetchTemplates(); setDialogOpen(false);
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/templates/${id}`, { headers: authHeader() });
      await fetchTemplates();
      if (selectedId === id) setSelectedId(templates[0]?.id || '');
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setDeleteConfirm(null); }
  };

  // ── Manage Tickets handlers ───────────────────────────────────────────────
  const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed', 'Done', 'Reopened'];

  // Use refs to ensure handleSearch always reads the latest values
  const searchReporterRef = React.useRef(searchReporter);
  const searchAssigneeRef = React.useRef(searchAssignee);
  const searchKeyRef = React.useRef(searchKey);
  searchReporterRef.current = searchReporter;
  searchAssigneeRef.current = searchAssignee;
  searchKeyRef.current = searchKey;

  const searchAbortRef = React.useRef(null);

  const cancelSearch = React.useCallback(() => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    setSearchLoading(false);
  }, []);

  const handleSearch = async (overrides = {}) => {
    // Cancel any in-progress search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    const key = (overrides.issueKey !== undefined ? overrides.issueKey : searchKeyRef.current).trim().toUpperCase();
    const reporter = (overrides.reporter !== undefined ? overrides.reporter : searchReporterRef.current).trim();
    const assignee = (overrides.assignee !== undefined ? overrides.assignee : searchAssigneeRef.current).trim();

    if (!key && !reporter && !assignee && !searchStatus && !searchDateFrom && !searchDateTo) {
      return;
    }

    if (searchDateFrom && searchDateTo && searchDateFrom > searchDateTo) {
      setSearchError(t('jiraTickets.manage.dateRangeInvalid'));
      return;
    }

    setSearchLoading(true); setSearchError('');
    setTicketInfo(null); setTransitions([]); setTransitionResult(null); setSearchResults([]); setSearchTotal(0);
    if (key) {
      addRecentNtid(RECENT_TICKET_SEARCHES_KEY, key);
      setRecentTicketSearches(getRecentNtids(RECENT_TICKET_SEARCHES_KEY));
    }

    // If pure numeric key, do progressive prefix searches
    const isNumericKey = key && /^\d+$/.test(key);
    if (isNumericKey) {
      const abortController = new AbortController();
      searchAbortRef.current = abortController;
      const prefixes = ['ISDS', 'TPX', 'CHG', 'ECSR'];
      let accumulated = [];

      for (const prefix of prefixes) {
        if (abortController.signal.aborted) break;
        const fullKey = `${prefix}-${key}`;
        try {
          const { data } = await axios.get(`${API}/issues`, {
            headers: authHeader(),
            params: { issueKey: fullKey, maxResults: 10, startAt: 0 },
            signal: abortController.signal,
          });
          if (data.success) {
            const issues = (data.data?.issues || []).map((issue) => ({
              ...issue,
              templateId: issueTemplateBindings[issue.key] || issue.templateId || '',
            }));
            accumulated = [...accumulated, ...issues];
            if (!abortController.signal.aborted) {
              setSearchResults([...accumulated]);
              setSearchTotal(accumulated.length);
              // Auto-select first result
              if (accumulated.length > 0 && !ticketInfo) {
                setTicketInfo(accumulated[0]);
                try {
                  const transRes = await axios.get(`${API}/issues/${accumulated[0].key}/transitions`, {
                    headers: authHeader(),
                    signal: abortController.signal,
                  });
                  if (transRes.data.success) setTransitions(transRes.data.data);
                } catch { /* ignore */ }
              }
            }
          }
        } catch (e) {
          if (e.name === 'CanceledError' || e.name === 'AbortError' || abortController.signal.aborted) break;
          // Individual prefix search failure is non-fatal, continue
        }
      }

      if (!abortController.signal.aborted) {
        setSearchLoading(false);
      }
      searchAbortRef.current = null;
      return;
    }

    // Normal search (non-numeric key or other fields)
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    try {
      const { data } = await axios.get(`${API}/issues`, {
        headers: authHeader(),
        params: {
          issueKey: key || undefined,
          reporter: reporter || undefined,
          assignee: assignee || undefined,
          status: searchStatus || undefined,
          dateFrom: (key ? undefined : searchDateFrom) || undefined,
          dateTo: (key ? undefined : searchDateTo) || undefined,
          maxResults: 50,
          startAt: 0,
        },
        signal: abortController.signal,
      });

      if (data.success && !abortController.signal.aborted) {
        const issues = (data.data?.issues || []).map((issue) => ({
          ...issue,
          templateId: issueTemplateBindings[issue.key] || issue.templateId || '',
        }));
        setSearchResults(issues);
        setSearchTotal(data.data?.total || issues.length);

        if (issues.length > 0) {
          setTicketInfo(issues[0]);
          const transRes = await axios.get(`${API}/issues/${issues[0].key}/transitions`, {
            headers: authHeader(),
            signal: abortController.signal,
          });
          if (transRes.data.success) setTransitions(transRes.data.data);
        }
      }
    } catch (e) {
      if (e.name !== 'CanceledError' && e.name !== 'AbortError' && !abortController.signal.aborted) {
        setSearchError(e.response?.data?.details || e.response?.data?.message || t('jiraTickets.manage.searchError'));
      }
    } finally {
      if (!abortController.signal.aborted) setSearchLoading(false);
      searchAbortRef.current = null;
    }
  };

  const handleSelectIssue = async (issue) => {
    const selectedIssue = {
      ...issue,
      templateId: issue.templateId || issueTemplateBindings[issue.key] || '',
    };
    setTicketInfo(selectedIssue);
    setTransitionResult(null);
    setDescExpanded(false);
    rememberRecentTicket(selectedIssue);
    try {
      const [infoRes, transRes] = await Promise.all([
        axios.get(`${API}/issues/${issue.key}`, { headers: authHeader() }),
        axios.get(`${API}/issues/${issue.key}/transitions`, { headers: authHeader() }),
      ]);
      if (infoRes.data.success) {
        const fullIssue = {
          ...infoRes.data.data,
          templateId: selectedIssue.templateId,
        };
        setTicketInfo(fullIssue);
        rememberRecentTicket(fullIssue);
      }
      if (transRes.data.success) setTransitions(transRes.data.data);
    } catch (e) {
      setTransitions([]);
    }
  };

  const refreshTicket = async (key) => {
    try {
      const [infoRes, transRes] = await Promise.all([
        axios.get(`${API}/issues/${key}`, { headers: authHeader() }),
        axios.get(`${API}/issues/${key}/transitions`, { headers: authHeader() }),
      ]);
      if (infoRes.data.success) {
        const templateId = issueTemplateBindings[key] || (ticketInfo?.key === key ? ticketInfo?.templateId : '') || '';
        const infoWithTemplate = { ...infoRes.data.data, templateId };
        setTicketInfo(infoWithTemplate);
        rememberRecentTicket(infoWithTemplate);
      }
      if (transRes.data.success) setTransitions(transRes.data.data);
    } catch (e) { console.error('refreshTicket', e); }
  };

  const handleAddComment = async () => {
    if (!ticketInfo || !commentText.trim()) return;
    setCommentSaving(true);
    try {
      await axios.post(`${API}/issues/${ticketInfo.key}/comments`,
        { body: commentText.trim() }, { headers: authHeader() });
      setCommentOpen(false); setCommentText('');
      setCommentSuccess(t('jiraTickets.manage.commentAdded', { key: ticketInfo.key }));
      setTimeout(() => setCommentSuccess(''), 4000);
    } catch (e) { alert(e.response?.data?.message || e.message); }
    finally { setCommentSaving(false); }
  };

  const openTransition = (t) => {
    const prefilledFields = {};
    const templateId = ticketInfo?.templateId || issueTemplateBindings[ticketInfo?.key] || '';
    let templateForTicket = templateId ? findTemplateById(templateId) : null;

    // Fallback: guess template by ticket's component and summary
    if (!templateForTicket && ticketInfo && templates.length > 0) {
      const ticketComponents = ticketInfo.components || [];
      // Reverse-lookup componentId from component name
      const ticketComponentIds = ticketComponents.map(name => {
        const entry = Object.entries(COMPONENT_NAMES).find(([, v]) => v === name);
        return entry ? entry[0] : null;
      }).filter(Boolean);

      if (ticketComponentIds.length > 0) {
        const candidates = templates.filter(tpl =>
          ticketComponentIds.includes(tpl.componentId) && tpl.internalComponentCategoryId
        );
        if (candidates.length === 1) {
          templateForTicket = candidates[0];
        } else if (candidates.length > 1 && ticketInfo.summary) {
          // Try to match by summary pattern
          const summary = (ticketInfo.summary || '').toLowerCase();
          const matched = candidates.find(tpl => {
            const pattern = (tpl.summaryTemplate || '').toLowerCase()
              .replace(/\{[^}]+\}/g, '').trim();
            return pattern && summary.includes(pattern);
          });
          templateForTicket = matched || candidates[0];
        }
      }
    }

    if (templateForTicket && t?.fields) {
      for (const [fieldId, fieldDef] of Object.entries(t.fields)) {
        if (fieldDef.schema?.type !== 'option-with-child') continue;
        const parentOpts = fieldDef.allowedValues || [];
        const targetCategoryId = templateForTicket.internalComponentCategoryId || '';
        const targetCategory = (templateForTicket.internalComponentCategory || '').toLowerCase();
        const targetSubCategoryId = templateForTicket.internalComponentSubCategoryId || '';
        const targetSubCategory = (templateForTicket.internalComponentSubCategory || '').toLowerCase();

        let parent = null;
        if (targetCategoryId) parent = parentOpts.find(o => o.id === targetCategoryId) || null;
        if (!parent && targetCategory) {
          parent = parentOpts.find(o => (o.value || '').toLowerCase() === targetCategory)
            || parentOpts.find(o => (o.value || '').toLowerCase().includes(targetCategory));
        }
        if (!parent) continue;

        prefilledFields[fieldId] = { id: parent.id };
        const childOpts = parent.children || [];
        if (childOpts.length > 0) {
          let child = null;
          if (targetSubCategoryId) child = childOpts.find(c => c.id === targetSubCategoryId) || null;
          if (!child && targetSubCategory) {
            child = childOpts.find(c => (c.value || '').toLowerCase() === targetSubCategory)
              || childOpts.find(c => (c.value || '').toLowerCase().includes(targetSubCategory));
          }
          if (child) prefilledFields[fieldId] = { id: parent.id, child: { id: child.id } };
        }
        break;
      }
    }

    setActiveTransition(t);
    setTransitionFields(prefilledFields);
    setTransitionResult(null);
    setTransitionOpen(true);
  };

  const saveTemplateInternalComponentFromTransition = useCallback(async (templateId, transition, fieldsPayload) => {
    if (!templateId || !transition || !fieldsPayload || Object.keys(fieldsPayload).length === 0) return;
    if (!/close/i.test(transition.name || '') && !/close/i.test(transition.toStatus || '')) return;

    const optionWithChildEntry = Object.entries(transition.fields || {})
      .find(([fieldId, fieldDef]) => fieldDef?.schema?.type === 'option-with-child' && fieldsPayload[fieldId]?.id);
    if (!optionWithChildEntry) return;

    const [fieldId, fieldDef] = optionWithChildEntry;
    const selectedParentId = fieldsPayload[fieldId]?.id || '';
    const selectedChildId = fieldsPayload[fieldId]?.child?.id || '';
    if (!selectedParentId) return;

    const parentOpts = fieldDef.allowedValues || [];
    const selectedParent = parentOpts.find(o => o.id === selectedParentId) || null;
    const selectedChild = (selectedParent?.children || []).find(c => c.id === selectedChildId) || null;

    const payload = {
      internalComponentCategory: selectedParent?.value || '',
      internalComponentSubCategory: selectedChild?.value || '',
      internalComponentCategoryId: selectedParentId,
      internalComponentSubCategoryId: selectedChildId,
      internalComponentFieldId: fieldId,
    };

    await axios.put(`${API}/templates/${templateId}`, payload, { headers: authHeader() });
    await fetchTemplates();
  }, [fetchTemplates]);

  const handleDoTransition = async () => {
    if (!ticketInfo || !activeTransition) return;
    setTransitionSaving(true);
    try {
      const transitionPayload = { ...transitionFields };
      await axios.post(`${API}/issues/${ticketInfo.key}/transition`,
        { transitionId: activeTransition.id, fields: transitionPayload },
        { headers: authHeader() });

      const templateIdForUpdate = ticketInfo.templateId || '';
      if (templateIdForUpdate) {
        try {
          await saveTemplateInternalComponentFromTransition(templateIdForUpdate, activeTransition, transitionPayload);
        } catch {
          // Do not block transition success if template sync fails.
        }
      }

      setTransitionResult(null);
      await refreshTicket(ticketInfo.key);
      setTransitionOpen(false);
      // Refresh pending approvals after 3 seconds to remove resolved tickets
      if (approvalMonitorOn) {
        setTimeout(() => fetchPendingApprovals(), 3000);
      }
    } catch (e) {
      setTransitionResult({ success: false, message: e.response?.data?.message || e.message });
    } finally { setTransitionSaving(false); }
  };

  // Render a single transition-screen field (handles option-with-child cascading select)
  const renderTransitionField = (fieldId, fieldDef) => {
    if (fieldDef.schema?.type === 'option-with-child') {
      const parentVal = transitionFields[fieldId]?.id || '';
      const parentOpts = fieldDef.allowedValues || [];
      const selectedParent = parentOpts.find(o => o.id === parentVal);
      const childOpts = selectedParent?.children || [];
      const childVal = transitionFields[fieldId]?.child?.id || '';
      return (
        <Box key={fieldId} sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
            <InputLabel sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.manage.fieldCategory', { name: fieldDef.name })}</InputLabel>
            <Select
              label={t('jiraTickets.manage.fieldCategory', { name: fieldDef.name })}
              value={parentVal}
              onChange={e => setTransitionFields(prev => ({ ...prev, [fieldId]: { id: e.target.value } }))}
              sx={selectSx}
            >
              {parentOpts.map(o => <MenuItem key={o.id} value={o.id}>{o.value}</MenuItem>)}
            </Select>
          </FormControl>
          {childOpts.length > 0 && (
            <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
              <InputLabel sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.manage.fieldSubCategory', { name: fieldDef.name })}</InputLabel>
              <Select
                label={t('jiraTickets.manage.fieldSubCategory', { name: fieldDef.name })}
                value={childVal}
                onChange={e => setTransitionFields(prev => ({
                  ...prev,
                  [fieldId]: { ...prev[fieldId], child: { id: e.target.value } },
                }))}
                sx={selectSx}
              >
                {childOpts.map(o => <MenuItem key={o.id} value={o.id}>{o.value}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
      );
    }
    return null;
  };

  // ── Shared sx shortcuts ───────────────────────────────────────────────────
  const selectSx = {
    color: 'var(--text-primary)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-color)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-color)' },
    '& .MuiSvgIcon-root': { color: 'var(--text-secondary)' },
  };

  const textFieldSx = {
    '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
    '& .MuiOutlinedInput-root': {
      color: 'var(--text-primary)',
      '& fieldset': { borderColor: 'var(--border-color)' },
      '&:hover fieldset': { borderColor: 'var(--primary-color)' },
    },
  };

  const primaryBtn = {
    backgroundColor: 'var(--primary-color)',
    '&:hover': { backgroundColor: 'var(--primary-hover)' },
    textTransform: 'none',
    fontWeight: 600,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* Sub-tabs */}
      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={subTabSx}>
        <Tab label={t('jiraTickets.subtabs.create')} iconPosition="start" />
        <Tab label={t('jiraTickets.subtabs.templates')} iconPosition="start" />
        <Tab label={t('jiraTickets.subtabs.manage')} iconPosition="start" />
        <Tab label={t('jiraTickets.subtabs.config')} iconPosition="start" />
      </Tabs>

      {/* ── Not configured warning (shown on tabs 0-2) ──────────────────── */}
      {mainTab < 3 && jiraConfigured === false && (
        <Alert severity="warning" sx={{ mb: 3 }} action={
          <Button size="small" onClick={() => setMainTab(3)} sx={{ textTransform: 'none' }}>
            {t('jiraTickets.config.goToConfigure')}
          </Button>
        }>
          {t('jiraTickets.config.notConfiguredWarning')}
        </Alert>
      )}

      {/* ── Tab 0: 创建工单 ──────────────────────────────────────────── */}
      {mainTab === 0 && jiraConfigured && (
        <Box>
          {/* Top row: left form + right summary/description */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'stretch' }}>
            {/* Left: template + reporter + assignee + create button */}
            <Box sx={{
              flex: '1 1 240px',
              maxWidth: 320,
              minWidth: 240,
              '& .MuiInputLabel-root': { fontSize: '0.95rem' },
              '& .MuiInputBase-input': { fontSize: '0.95rem' },
              '& .MuiFormHelperText-root': { fontSize: '0.78rem' },
              '& .MuiButton-root': { fontSize: '0.9rem' },
            }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.create.selectTemplate')}</InputLabel>
                <Select
                  value={selectedId}
                  label={t('jiraTickets.create.selectTemplate')}
                  onChange={e => {
                    const nextId = e.target.value;
                    const nextTemplate = templates.find(t => t.id === nextId);
                    setSelectedId(nextId);
                    setVarValues({});
                    setCustomSummary(nextTemplate?.summaryTemplate || '');
                    setCustomDescription(nextTemplate?.descriptionTemplate || '');
                    setResults([]);
                    recordTemplateUsage(nextId);
                    addRecentTemplateId(nextId);
                  }}
                  sx={selectSx}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 480 } } }}
                >
                  {(() => {
                    const usage = getTemplateUsage();
                    const recentIds = getRecentTemplateIds();
                    const recentTemplates = recentIds.map(id => templates.find(t => t.id === id)).filter(Boolean);
                    const items = [];

                    // Recently used section
                    if (recentTemplates.length > 0) {
                      items.push(
                        <MenuItem key="cat-recent" disabled
                          sx={{ fontSize: '0.68rem', color: 'var(--primary-color)', fontWeight: 700, letterSpacing: 0.5, py: 0.5, minHeight: 24 }}>
                          {t('jiraTickets.create.recentlyUsed', '最近使用').toUpperCase()}
                        </MenuItem>
                      );
                      recentTemplates.forEach(tpl => {
                        items.push(
                          <MenuItem key={`recent-${tpl.id}`} value={tpl.id}
                            sx={{ pl: 3, py: 0.5, minHeight: 32, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {tpl.name}
                          </MenuItem>
                        );
                      });
                    }

                    // Category sections with frequency sorting
                    ['daily', 'weekly', 'monthly', 'support', 'custom'].forEach(cat => {
                      const label = getCategoryLabel(cat);
                      const group = templates.filter(t => t.category === cat);
                      if (!group.length) return;
                      // Sort by usage frequency desc, then name asc
                      const sorted = [...group].sort((a, b) => {
                        const fa = usage[a.id] || 0, fb = usage[b.id] || 0;
                        if (fb !== fa) return fb - fa;
                        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
                      });
                      items.push(
                        <MenuItem key={`cat-${cat}`} disabled
                          sx={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: 0.5, py: 0.5, minHeight: 24 }}>
                          {label.toUpperCase()}
                        </MenuItem>
                      );
                      sorted.forEach(tpl => {
                        items.push(
                          <MenuItem key={tpl.id} value={tpl.id}
                            sx={{ pl: 3, py: 0.5, minHeight: 32, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {tpl.name}
                          </MenuItem>
                        );
                      });
                    });
                    return items;
                  })()}
                </Select>
              </FormControl>

              {selectedTemplate?.inputs?.filter(inp => inp.key !== 'ntid' && inp.key !== 'fullname').map(inp => (
                <TextField key={inp.key} fullWidth label={inp.label}
                  value={varValues[inp.key] || ''}
                  onChange={e => setVarValues(prev => ({ ...prev, [inp.key]: e.target.value }))}
                  sx={{ ...textFieldSx, mb: 2 }} />
              ))}

              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  multiple
                  freeSolo
                  PopperComponent={FixedBottomPopper}
                  value={reporters}
                  inputValue={reporterInput}
                  options={reporterOptions}
                  loading={reporterLoading}
                  ListboxProps={{
                    style: {
                      maxHeight: AUTOCOMPLETE_VISIBLE_COUNT * AUTOCOMPLETE_ROW_HEIGHT,
                      overflowY: 'auto',
                    },
                  }}
                  onOpen={() => {
                    if (reporterInput && reporterInput.trim()) fetchReporterUsers(reporterInput.trim());
                  }}
                  onInputChange={(_, val, reason) => {
                    setReporterInput(val);
                    if (reason === 'input') fetchReporterUsers(val);
                    if (reason === 'clear') setReporterOptions([]);
                  }}
                  onChange={(_, newVal) => {
                    const normalized = newVal.map(v => {
                      if (typeof v === 'string') return v.trim().replace(/,$/, '');
                      return v?.name || '';
                    }).filter(Boolean);
                    setReporters([...new Set(normalized)]);
                    normalized.forEach(r => addRecentNtid(RECENT_REPORTERS_KEY, r));
                    setRecentReporters(getRecentNtids(RECENT_REPORTERS_KEY));
                  }}
                  getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
                  renderOption={(props, opt) => (
                    <li {...props} key={opt.name || opt} style={{ ...props.style, padding: '4px 12px' }}>
                      <Box sx={{ lineHeight: 1.3 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.83rem' }}>
                          {opt.displayName || opt.name || opt}
                          {opt.isRecent && <Chip label="recent" size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem' }} />}
                        </Typography>
                        {opt.email && (
                          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            {opt.email}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((r, index) => (
                      <Chip {...getTagProps({ index })} key={r} label={r} size="small" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params}
                      label={t('jiraTickets.create.reporterLabel')}
                      placeholder={reporters.length === 0 ? t('jiraTickets.create.reporterPlaceholder') : ''}
                      InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing && reporterInput.trim()) {
                          e.preventDefault();
                          const val = reporterInput.trim().replace(/,$/, '');
                          if (val) {
                            setReporters(prev => [...new Set([...prev, val])]);
                            setReporterInput('');
                            addRecentNtid(RECENT_REPORTERS_KEY, val);
                            setRecentReporters(getRecentNtids(RECENT_REPORTERS_KEY));
                          }
                        }
                      }}
                      InputProps={{ ...params.InputProps, endAdornment: (
                        <>{reporterLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>
                      )}} />
                  )}
                  sx={textFieldSx}
                />
                {recentReporters.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', lineHeight: '24px', mr: 0.5 }}>
                      {t('jiraTickets.create.recentlyUsed')}:
                    </Typography>
                    {recentReporters.filter(r => !reporters.includes(r)).slice(0, 4).map(r => (
                      <Chip key={r} label={r} size="small" variant="outlined"
                        onClick={() => setReporters(prev => [...new Set([...prev, r])])}
                        sx={{ cursor: 'pointer', fontSize: '0.7rem', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} />
                    ))}
                  </Stack>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                <UserAutocomplete
                  value={assigneeInput}
                  onChange={setAssigneeInput}
                  onEnter={(val) => {
                    setAssigneeInput(val.trim());
                  }}
                  recentKey={RECENT_ASSIGNEES_KEY}
                  label={t('jiraTickets.create.assigneeLabel', 'Assignee（默认当前登录用户）')}
                  placeholder={t('jiraTickets.create.assigneePlaceholder', '输入 Jira 用户名')}
                  sx={textFieldSx}
                />
                {recentAssignees.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', lineHeight: '24px', mr: 0.5 }}>
                      {t('jiraTickets.create.recentlyUsed')}:
                    </Typography>
                    {recentAssignees.filter(a => a !== assigneeInput).slice(0, 4).map(a => (
                      <Chip key={a} label={a} size="small" variant="outlined"
                        onClick={() => setAssigneeInput(a)}
                        sx={{ cursor: 'pointer', fontSize: '0.7rem', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} />
                    ))}
                  </Stack>
                )}
              </Box>

              <Button fullWidth variant="contained"
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <Send />}
                onClick={handleCreate}
                disabled={creating || !selectedTemplate || reporters.length === 0}
                sx={primaryBtn}>
                {creating ? t('jiraTickets.create.creating') : t('jiraTickets.create.createForCount', { count: reporters.length })}
              </Button>
              {reporters.length > 1 && (
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 1 }}>
                  系统将为每个 Reporter 创建一张工单，描述中 {'{ntid}'} 会自动替换为对应的 Reporter NTID
                </Typography>
              )}
            </Box>

            {/* Right: summary/description */}
            <Box sx={{
              flex: '3 1 600px',
              minWidth: 400,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {selectedTemplate && (
                <TextField fullWidth label={t('jiraTickets.create.summaryLabel')}
                  value={customSummary}
                  onChange={e => setCustomSummary(e.target.value)}
                  sx={{ ...textFieldSx, mb: 2 }} />
              )}

              {selectedTemplate && (
                <>
                  <TextField fullWidth multiline minRows={3} maxRows={12} label={t('jiraTickets.create.descriptionLabel')}
                    value={customDescription}
                    onChange={e => setCustomDescription(e.target.value)}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text/plain');
                      if (text && text.includes('\t')) {
                        e.preventDefault();
                        const lines = text.split(/\r?\n/).filter(l => l.trim());
                        if (lines.length > 0) {
                          const rows = lines.map(l => l.split('\t'));
                          const header = '||' + rows[0].join('||') + '||';
                          const body = rows.slice(1).map(r => '|' + r.join('|') + '|').join('\n');
                          const table = header + '\n' + body;
                          const input = e.target;
                          const start = input.selectionStart;
                          const end = input.selectionEnd;
                          const before = customDescription.slice(0, start);
                          const after = customDescription.slice(end);
                          setCustomDescription(before + table + after);
                        }
                      }
                    }}
                    helperText={t('jiraTickets.create.descriptionHelp')}
                    sx={{ ...textFieldSx, mb: customDescription && HAS_TABLE_RE.test(customDescription) ? 1 : 0, flex: 1, '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' }, '& .MuiInputBase-inputMultiline': { height: '100% !important', overflow: 'auto !important' } }} />

                  {customDescription && HAS_TABLE_RE.test(customDescription) && (
                    <Box sx={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 1,
                      p: 1.5,
                      mb: 2,
                      backgroundColor: 'var(--background-secondary)',
                    }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                        预览
                      </Typography>
                      {renderJiraDescription(customDescription, true)}
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* Full-width bottom: results + recent tickets */}
          <Box sx={{
            '& .MuiTableCell-root': {
              fontSize: '0.82rem',
              py: 0.75,
            },
          }}>
            {results.length > 0 && (
              <Box sx={{ border: '1px solid var(--border-color)', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {t('jiraTickets.create.resultSummary', { success: results.filter(r => r.success).length, total: results.length })}
                </Typography>
                {results.map((r, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    {r.success ? (
                      <Alert severity={(r.extraFieldsSkipped || r.assigneeSkipped) ? 'warning' : 'success'} sx={{ py: 0 }}
                        action={
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title={t('jiraTickets.create.quickComment')}>
                              <IconButton size="small" onClick={() => { setTicketInfo({ key: r.issueKey }); setCommentOpen(true); }}
                                sx={{ color: 'var(--text-secondary)' }}>
                                <Comment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('jiraTickets.create.quickResolve')}>
                              <IconButton size="small" onClick={() => handleQuickResolve(r.issueKey)}
                                sx={{ color: 'var(--success-color, #4caf50)' }}>
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('jiraTickets.create.quickClose')}>
                              <IconButton size="small" onClick={() => handleQuickClose(r.issueKey)}
                                sx={{ color: 'var(--text-secondary)' }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }>
                        <strong>{r.reporter}</strong>{' → '}
                        <Link href={r.url} target="_blank" rel="noreferrer">{r.issueKey}</Link>
                        {r.extraFieldsSkipped && ` ${t('jiraTickets.create.extraFieldsSkipped')}`}
                        {r.assigneeSkipped && ` ${t('jiraTickets.create.assigneeSkipped')}`}
                      </Alert>
                    ) : (
                      <Alert severity="error" sx={{ py: 0 }}>
                        <strong>{r.reporter}</strong>: {r.error}
                      </Alert>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ mt: results.length > 0 ? 2 : 0, border: '1px solid var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem' }}>
                  {t('jiraTickets.manage.recentOpenedTitle', {
                    count: MAX_RECENT_TICKETS,
                    defaultValue: 'Recently Opened Tickets (latest {{count}})',
                  })}
                </Typography>
              </Box>

              {recentOpenedTickets.length === 0 ? (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    暂无历史工单
                  </Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('jiraTickets.manage.ticketLabel')}</TableCell>
                      <TableCell>{t('jiraTickets.manage.summary')}</TableCell>
                      <TableCell>{t('jiraTickets.manage.reporter')}</TableCell>
                      <TableCell>{t('jiraTickets.manage.statusLabel')}</TableCell>
                      <TableCell>{t('jiraTickets.manage.createdAt')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOpenedTickets.map((row) => (
                      <React.Fragment key={row.key}>
                        <TableRow
                          hover
                          selected={ticketInfo?.key === row.key}
                          onClick={() => handleSelectIssue(row)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{row.key}</TableCell>
                          <TableCell sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.summary || '-'}
                          </TableCell>
                          <TableCell>{row.reporter || '-'}</TableCell>
                          <TableCell>{row.status || '-'}</TableCell>
                          <TableCell>{row.created ? new Date(row.created).toLocaleString() : '-'}</TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                            <Collapse in={ticketInfo?.key === row.key} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, borderTop: '2px solid var(--primary-color)', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Link href={ticketInfo?.url || row.url || '#'} target="_blank" rel="noreferrer"
                                      sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)', textDecorationColor: 'var(--primary-color)' }}>
                                      {ticketInfo?.key || row.key}
                                    </Link>
                                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                      {ticketInfo?.issuetype || row.issuetype || ''}
                                    </Typography>
                                  </Box>
                                  <Chip label={ticketInfo?.status || row.status || '-'} size="small" color={statusColor(ticketInfo?.statusCategory || row.statusCategory)} />
                                </Box>

                                <Typography sx={{ mb: 1, color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {ticketInfo?.summary || row.summary || '-'}
                                </Typography>

                                {(ticketInfo?.description || row.description) && (
                                  <Box sx={{ mb: 1.5 }}>
                                    {renderJiraDescription(ticketInfo?.description || row.description, descExpanded)}
                                    {(((ticketInfo?.description || row.description) || '').split('\n').length > 2 || ((ticketInfo?.description || row.description) || '').length > 120) && (
                                      <Button size="small" onClick={() => setDescExpanded(!descExpanded)}
                                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                                        {descExpanded ? t('common.collapse') : t('common.more')}
                                      </Button>
                                    )}
                                  </Box>
                                )}

                                <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
                                  {[
                                    [t('jiraTickets.manage.reporter'), ticketInfo?.reporter || row.reporter],
                                    [t('jiraTickets.manage.assignee'), ticketInfo?.assignee || row.assignee],
                                    (ticketInfo?.plannedStartDate || row.plannedStartDate)
                                      ? ['Planned Start Date', formatJiraDateTime(ticketInfo?.plannedStartDate || row.plannedStartDate)]
                                      : null,
                                    (ticketInfo?.plannedEndDate || row.plannedEndDate)
                                      ? ['Planned End Date', formatJiraDateTime(ticketInfo?.plannedEndDate || row.plannedEndDate)]
                                      : null,
                                    (ticketInfo?.components?.length > 0 || row.components?.length > 0)
                                      ? [t('jiraTickets.manage.component'), (ticketInfo?.components || row.components || []).join(', ')]
                                      : null,
                                  ].filter(Boolean).map(([label, val]) => (
                                    <Typography key={label} variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                      {label}: <strong style={{ color: 'var(--text-primary)' }}>{val || '-'}</strong>
                                    </Typography>
                                  ))}
                                </Box>

                                <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <Button size="small" variant="outlined" startIcon={<Comment />}
                                    onClick={() => {
                                      setTicketInfo(ticketInfo?.key === row.key ? ticketInfo : row);
                                      setCommentText('');
                                      setCommentOpen(true);
                                    }}
                                    sx={{ textTransform: 'none', borderColor: 'var(--border-color)', color: 'var(--text-primary)',
                                      '&:hover': { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } }}>
                                    {t('jiraTickets.manage.addComment')}
                                  </Button>

                                  {transitions.map(tr => (
                                    <Button key={tr.id} size="small" variant="outlined"
                                      color={tr.toStatus === 'Closed' || tr.toStatus === 'Resolved' ? 'success' : 'primary'}
                                      startIcon={<CheckCircle />}
                                      onClick={() => {
                                        setTicketInfo(ticketInfo?.key === row.key ? ticketInfo : row);
                                        openTransition(tr);
                                      }}
                                      sx={{ textTransform: 'none' }}>
                                      {tr.name}
                                    </Button>
                                  ))}

                                  {transitions.length === 0 && (
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                      {t('jiraTickets.manage.noActions')}
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Tab 1: 管理模板 ──────────────────────────────────────────── */}
      {mainTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              {t('jiraTickets.templates.total', { count: templates.length })}
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={primaryBtn}>
              {t('jiraTickets.templates.add')}
            </Button>
          </Box>
          <TableContainer sx={{ border: '1px solid var(--border-color)', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'var(--background-secondary)' }}>
                  {[t('jiraTickets.templates.table.name'), t('jiraTickets.templates.table.category'), 'Component', t('jiraTickets.templates.table.summaryTemplate'), t('common.actions')].map(h => (
                    <TableCell key={h} sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...templates].sort((a, b) => {
                  const catOrder = ['daily', 'weekly', 'monthly', 'support', 'custom'];
                  const ca = catOrder.indexOf(a.category), cb = catOrder.indexOf(b.category);
                  if (ca !== cb) return ca - cb;
                  return (a.name || '').localeCompare(b.name || '', 'zh-CN');
                }).map(tpl => (
                  <TableRow key={tpl.id} sx={{ '&:hover': { backgroundColor: 'var(--background-highlight)' } }}>
                    <TableCell sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                      {tpl.name}
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid var(--border-color)' }}>
                      <Chip label={getCategoryLabel(tpl.category)} size="small"
                        sx={{ fontSize: '0.7rem', backgroundColor: 'var(--background-info-light)', color: 'var(--text-primary)' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      {COMPONENT_NAMES[tpl.componentId] || tpl.componentId}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>
                      <Tooltip title={tpl.summaryTemplate}><span>{tpl.summaryTemplate}</span></Tooltip>
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: '1px solid var(--border-color)' }}>
                      <Tooltip title={t('jiraTickets.templates.clone')}>
                        <IconButton size="small" onClick={() => openClone(tpl)} sx={{ color: 'var(--text-secondary)' }}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => openEdit(tpl)} sx={{ color: 'var(--primary-color)' }}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteConfirm(tpl.id)} sx={{ color: 'var(--error-color)' }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ── Tab 2: 管理工单 ──────────────────────────────────────────── */}
      {mainTab === 2 && jiraConfigured && (
        <Box>
          {/* Search bar */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'nowrap' }}>
              <Autocomplete
                freeSolo
                size="small"
                options={recentTicketSearches}
                inputValue={searchKey}
                onInputChange={(_, val, reason) => {
                  setSearchKey((val || '').toUpperCase());
                  if (reason === 'clear') cancelSearch();
                }}
                onChange={(_, val) => {
                  const keyVal = (typeof val === 'string' ? val : '').toUpperCase();
                  setSearchKey(keyVal);
                  if (keyVal) handleSearch({ issueKey: keyVal });
                }}
                openOnFocus
                filterOptions={(options, state) => {
                  const input = String(state.inputValue || '').toUpperCase().trim();
                  if (!input) return options.slice(0, 5);
                  return options.filter((opt) => String(opt || '').toUpperCase().includes(input)).slice(0, 5);
                }}
                ListboxProps={{ style: { maxHeight: AUTOCOMPLETE_VISIBLE_COUNT * AUTOCOMPLETE_ROW_HEIGHT, overflowY: 'auto' } }}
                PopperComponent={FixedBottomPopper}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('jiraTickets.manage.ticketLabel')}
                    placeholder={t('jiraTickets.manage.ticketPlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSearch()}
                    InputLabelProps={{ shrink: true }}
                    sx={{ ...textFieldSx, width: 130 }}
                  />
                )}
              />
              <UserAutocomplete
                value={searchReporter}
                onChange={(val) => { setSearchReporter(val); if (!val) cancelSearch(); }}
                onEnter={(val) => handleSearch({ reporter: val })}
                recentKey={RECENT_REPORTERS_KEY}
                label={t('jiraTickets.manage.reporterNtid')} placeholder={t('jiraTickets.manage.reporterNtidPlaceholder')}
                size="small" sx={{ ...textFieldSx, width: 155 }}
              />
              <UserAutocomplete
                value={searchAssignee}
                onChange={(val) => { setSearchAssignee(val); if (!val) cancelSearch(); }}
                onEnter={(val) => handleSearch({ assignee: val })}
                recentKey={RECENT_ASSIGNEES_KEY}
                label={t('jiraTickets.manage.assigneeNtid')} placeholder={t('jiraTickets.manage.assigneeNtidPlaceholder')}
                size="small" sx={{ ...textFieldSx, width: 155 }}
              />
              <FormControl size="small" sx={{ minWidth: 110, width: 110 }}>
                <InputLabel shrink sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.manage.statusLabel')}</InputLabel>
                <Select
                  label={t('jiraTickets.manage.statusLabel')}
                  value={searchStatus}
                  onChange={e => setSearchStatus(e.target.value)}
                  displayEmpty
                  notched
                  sx={selectSx}
                >
                  <MenuItem value="">{t('jiraTickets.manage.statusAll')}</MenuItem>
                  {statusOptions.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={t('jiraTickets.manage.dateFrom')}
                type="date"
                value={searchDateFrom}
                onChange={e => setSearchDateFrom(e.target.value)}
                size="small"
                sx={{ ...textFieldSx, width: 150 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('jiraTickets.manage.dateTo')}
                type="date"
                value={searchDateTo}
                onChange={e => setSearchDateTo(e.target.value)}
                size="small"
                sx={{ ...textFieldSx, width: 150 }}
                InputLabelProps={{ shrink: true }}
              />
              <IconButton
                onClick={handleSearch} disabled={searchLoading}
                sx={{ backgroundColor: 'var(--primary-color)', color: '#fff', borderRadius: '6px', width: 36, height: 36,
                  '&:hover': { backgroundColor: 'var(--primary-hover)' } }}>
                {searchLoading ? <CircularProgress size={16} color="inherit" /> : <Search />}
              </IconButton>

              {/* ── 待审批监控开关 ── */}
              <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={approvalMonitorOn}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          pendingInitializedRef.current = false;
                          setPendingError('');
                          setPendingApprovals([]);
                          ensurePendingAudioContext();
                        }
                        setApprovalMonitorOn(checked);
                      }}
                      color="warning"
                      size="small"
                    />
                  }
                  label={
                    <Chip
                      label={approvalMonitorOn
                        ? (pendingLoading
                          ? t('jiraTickets.manage.pendingApprovalLoading', { defaultValue: 'Checking...' })
                          : t('jiraTickets.manage.pendingApprovalCount', {
                            count: pendingApprovals.length,
                            defaultValue: 'Pending Approval ({{count}})',
                          }))
                        : t('jiraTickets.manage.pendingApprovalMonitor', { defaultValue: 'Pending Approval Monitor' })}
                      size="small"
                      color={approvalMonitorOn ? (pendingApprovals.length > 0 ? 'warning' : 'success') : 'default'}
                      variant={approvalMonitorOn ? 'filled' : 'outlined'}
                      sx={approvalMonitorOn ? {
                        '@keyframes monitorPulse': {
                          '0%': { opacity: 0.82, transform: 'scale(1)' },
                          '50%': { opacity: 1, transform: 'scale(1.03)' },
                          '100%': { opacity: 0.82, transform: 'scale(1)' },
                        },
                        animation: 'monitorPulse 1.8s ease-in-out infinite',
                        boxShadow: pendingApprovals.length > 0
                          ? '0 0 0 2px rgba(237,108,2,0.18)'
                          : '0 0 0 2px rgba(76,175,80,0.16)',
                      } : undefined}
                    />
                  }
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>
          </Box>

          {/* ── 待审批结果面板 ── */}
          {approvalMonitorOn && (
            <Box sx={{ mb: 2, border: '1px solid var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)',
                display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem', flexGrow: 1 }}>
                  {t('jiraTickets.manage.pendingApprovalPanelTitle', {
                    defaultValue: 'Tickets Awaiting My Approval (auto-refreshes every 30 seconds, uses the same date range as above)',
                  })}
                </Typography>
                {pendingLoading && <CircularProgress size={14} />}
                <Tooltip title={t('jiraTickets.manage.refreshNow', { defaultValue: 'Refresh now' })}>
                  <IconButton size="small" onClick={fetchPendingApprovals} disabled={pendingLoading}
                    sx={{ color: 'var(--text-secondary)' }}>
                    <Search fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {pendingError ? (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Alert severity="warning" sx={{ py: 0, fontSize: '0.8rem' }}>{pendingError}</Alert>
                </Box>
              ) : pendingApprovals.length === 0 ? (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {pendingLoading
                      ? t('jiraTickets.manage.pendingApprovalLoading', { defaultValue: 'Checking...' })
                      : t('jiraTickets.manage.pendingApprovalEmpty', { defaultValue: 'No pending approval tickets' })}
                  </Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 110 }}>{t('jiraTickets.manage.ticketLabel')}</TableCell>
                      <TableCell>{t('jiraTickets.manage.summary')}</TableCell>
                      <TableCell sx={{ width: 140 }}>{t('jiraTickets.manage.reporter')}</TableCell>
                      <TableCell sx={{ width: 90 }}>{t('jiraTickets.manage.statusLabel')}</TableCell>
                      <TableCell sx={{ width: 160 }}>{t('jiraTickets.manage.createdAt')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingApprovals.map(row => (
                      <React.Fragment key={row.key}>
                        <TableRow hover selected={ticketInfo?.key === row.key}
                          onClick={() => handleSelectIssue(row)} sx={{ cursor: 'pointer' }}>
                          <TableCell>
                            <Chip label={row.key} size="small" color="warning" variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.summary}
                          </TableCell>
                          <TableCell>{row.reporter || '-'}</TableCell>
                          <TableCell>{row.status || '-'}</TableCell>
                          <TableCell>{row.created ? new Date(row.created).toLocaleString() : '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                            <Collapse in={ticketInfo?.key === row.key} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, borderTop: '2px solid var(--warning-color, #ed6c02)',
                                backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Link href={ticketInfo?.url || row.url || '#'} target="_blank" rel="noreferrer"
                                      sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)' }}>
                                      {ticketInfo?.key || row.key}
                                    </Link>
                                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                      {ticketInfo?.issuetype || row.issuetype || ''}
                                    </Typography>
                                  </Box>
                                  <Chip label={ticketInfo?.status || row.status || '-'}
                                    size="small" color={statusColor(ticketInfo?.statusCategory || row.statusCategory)} />
                                </Box>
                                <Typography sx={{ mb: 1, color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {ticketInfo?.summary || row.summary || '-'}
                                </Typography>
                                {(ticketInfo?.description || row.description) && (
                                  <Box sx={{ mb: 1.5 }}>
                                    {renderJiraDescription(ticketInfo?.description || row.description, descExpanded)}
                                    {(((ticketInfo?.description || row.description) || '').split('\n').length > 2
                                      || ((ticketInfo?.description || row.description) || '').length > 120) && (
                                      <Button size="small" onClick={() => setDescExpanded(!descExpanded)}
                                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                                        {descExpanded ? t('common.collapse') : t('common.more')}
                                      </Button>
                                    )}
                                  </Box>
                                )}
                                <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
                                  {[
                                    [t('jiraTickets.manage.reporter'), ticketInfo?.reporter || row.reporter],
                                    [t('jiraTickets.manage.assignee'), ticketInfo?.assignee || row.assignee],
                                    (ticketInfo?.plannedStartDate || row.plannedStartDate)
                                      ? ['Planned Start Date', formatJiraDateTime(ticketInfo?.plannedStartDate || row.plannedStartDate)]
                                      : null,
                                    (ticketInfo?.plannedEndDate || row.plannedEndDate)
                                      ? ['Planned End Date', formatJiraDateTime(ticketInfo?.plannedEndDate || row.plannedEndDate)]
                                      : null,
                                    (ticketInfo?.components?.length > 0 || row.components?.length > 0)
                                      ? [t('jiraTickets.manage.component'), (ticketInfo?.components || row.components || []).join(', ')]
                                      : null,
                                  ].filter(Boolean).map(([label, val]) => (
                                    <Typography key={label} variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                      {label}: <strong style={{ color: 'var(--text-primary)' }}>{val || '-'}</strong>
                                    </Typography>
                                  ))}
                                </Box>
                                <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <Button size="small" variant="outlined" startIcon={<Comment />}
                                    onClick={() => { setTicketInfo(ticketInfo?.key === row.key ? ticketInfo : row); setCommentText(''); setCommentOpen(true); }}
                                    sx={{ textTransform: 'none', borderColor: 'var(--border-color)', color: 'var(--text-primary)',
                                      '&:hover': { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } }}>
                                    {t('jiraTickets.manage.addComment')}
                                  </Button>
                                  {transitions.map(tr => (
                                    <Button key={tr.id} size="small" variant="outlined"
                                      color={tr.id === 'approve-added' ? 'warning'
                                        : (tr.toStatus === 'Closed' || tr.toStatus === 'Resolved' ? 'success' : 'primary')}
                                      startIcon={<CheckCircle />}
                                      onClick={() => { setTicketInfo(ticketInfo?.key === row.key ? ticketInfo : row); openTransition(tr); }}
                                      sx={{ textTransform: 'none' }}>
                                      {tr.name}
                                    </Button>
                                  ))}
                                  {transitions.length === 0 && (
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                      {t('jiraTickets.manage.noActions')}
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}

          {searchResults.length > 0 && (
            <Box sx={{ mb: 2, border: '1px solid var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  {t('jiraTickets.manage.searchTotal', { total: searchTotal })}
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('jiraTickets.manage.ticketLabel')}</TableCell>
                    <TableCell>{t('jiraTickets.manage.summary')}</TableCell>
                    <TableCell>{t('jiraTickets.manage.reporter')}</TableCell>
                    <TableCell>{t('jiraTickets.manage.statusLabel')}</TableCell>
                    <TableCell>{t('jiraTickets.manage.createdAt')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((row) => (
                    <React.Fragment key={row.key}>
                      <TableRow
                        hover
                        selected={ticketInfo?.key === row.key}
                        onClick={() => handleSelectIssue(row)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{row.key}</TableCell>
                        <TableCell sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.summary}
                        </TableCell>
                        <TableCell>{row.reporter || '-'}</TableCell>
                        <TableCell>{row.status || '-'}</TableCell>
                        <TableCell>{row.created ? new Date(row.created).toLocaleString() : '-'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                          <Collapse in={ticketInfo?.key === row.key} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, borderTop: '2px solid var(--primary-color)', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                  <Link href={ticketInfo.url} target="_blank" rel="noreferrer"
                                    sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary-color)', textDecorationColor: 'var(--primary-color)' }}>
                                    {ticketInfo.key}
                                  </Link>
                                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                    {ticketInfo.issuetype}
                                  </Typography>
                                </Box>
                                <Chip label={ticketInfo.status} size="small" color={statusColor(ticketInfo.statusCategory)} />
                              </Box>
                              <Typography sx={{ mb: 1, color: 'var(--text-primary)', fontWeight: 500 }}>
                                {ticketInfo.summary}
                              </Typography>
                              {ticketInfo.description && (
                                <Box sx={{ mb: 1.5 }}>
                                  {renderJiraDescription(ticketInfo.description, descExpanded)}
                                  {(ticketInfo.description.split('\n').length > 2 || ticketInfo.description.length > 120) && (
                                    <Button size="small" onClick={() => setDescExpanded(!descExpanded)}
                                      sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                                      {descExpanded ? t('common.collapse') : t('common.more')}
                                    </Button>
                                  )}
                                </Box>
                              )}
                              <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
                                {[
                                  [t('jiraTickets.manage.reporter'), ticketInfo.reporter],
                                  [t('jiraTickets.manage.assignee'), ticketInfo.assignee],
                                  ticketInfo.plannedStartDate
                                    ? ['Planned Start Date', formatJiraDateTime(ticketInfo.plannedStartDate)]
                                    : null,
                                  ticketInfo.plannedEndDate
                                    ? ['Planned End Date', formatJiraDateTime(ticketInfo.plannedEndDate)]
                                    : null,
                                  ticketInfo.components?.length > 0 ? [t('jiraTickets.manage.component'), ticketInfo.components.join(', ')] : null,
                                ].filter(Boolean).map(([label, val]) => (
                                  <Typography key={label} variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                    {label}: <strong style={{ color: 'var(--text-primary)' }}>{val}</strong>
                                  </Typography>
                                ))}
                              </Box>
                              <Divider sx={{ borderColor: 'var(--border-color)', mb: 1.5 }} />
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Button size="small" variant="outlined" startIcon={<Comment />}
                                  onClick={() => { setCommentText(''); setCommentOpen(true); }}
                                  sx={{ textTransform: 'none', borderColor: 'var(--border-color)', color: 'var(--text-primary)',
                                    '&:hover': { borderColor: 'var(--primary-color)', color: 'var(--primary-color)' } }}>
                                  {t('jiraTickets.manage.addComment')}
                                </Button>
                                {transitions.map(tr => (
                                  <Button key={tr.id} size="small" variant="outlined"
                                    color={tr.toStatus === 'Closed' || tr.toStatus === 'Resolved' ? 'success' : 'primary'}
                                    startIcon={<CheckCircle />}
                                    onClick={() => openTransition(tr)}
                                    sx={{ textTransform: 'none' }}>
                                    {tr.name}
                                  </Button>
                                ))}
                                {transitions.length === 0 && (
                                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                    {t('jiraTickets.manage.noActions')}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {searchLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
          {searchError && <Alert severity="error" sx={{ mb: 2 }}>{searchError}</Alert>}
          {transitionResult && (
            <Alert severity="error" sx={{ mb: 2 }}
              onClose={() => setTransitionResult(null)}>
              {transitionResult.message}
            </Alert>
          )}


        </Box>
      )}

      {/* ── Tab 3: 配置管理 ──────────────────────────────────────────── */}
      {mainTab === 3 && (
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>
            {t('jiraTickets.config.description')}
          </Typography>

          {configMsg && (
            <Alert severity={configMsg.type} sx={{ mb: 2 }} onClose={() => setConfigMsg(null)}>
              {configMsg.text}
            </Alert>
          )}

          <TextField
            fullWidth label={t('jiraTickets.config.serverUrl')}
            placeholder="https://jira.example.com"
            value={configData.jiraUrl}
            onChange={e => setConfigData(p => ({ ...p, jiraUrl: e.target.value }))}
            sx={{ ...textFieldSx, mb: 2 }}
          />
          <TextField
            fullWidth label={t('jiraTickets.config.apiToken')}
            placeholder={t('jiraTickets.config.apiTokenPlaceholder')}
            type="password"
            value={configData.jiraPat}
            onChange={e => setConfigData(p => ({ ...p, jiraPat: e.target.value }))}
            helperText={jiraConfigured ? t('jiraTickets.config.tokenMaskedHint') : ''}
            sx={{ ...textFieldSx, mb: 2 }}
          />
          <TextField
            fullWidth label={t('jiraTickets.config.serviceDeskId')}
            placeholder="107"
            value={configData.serviceDeskId}
            onChange={e => setConfigData(p => ({ ...p, serviceDeskId: e.target.value }))}
            helperText={t('jiraTickets.config.optionalField')}
            sx={{ ...textFieldSx, mb: 2 }}
          />
          <TextField
            fullWidth label={t('jiraTickets.config.requestTypeId')}
            placeholder="958"
            value={configData.requestTypeId}
            onChange={e => setConfigData(p => ({ ...p, requestTypeId: e.target.value }))}
            helperText={t('jiraTickets.config.optionalField')}
            sx={{ ...textFieldSx, mb: 3 }}
          />

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={handleSaveConfig} disabled={configSaving} sx={primaryBtn}>
              {configSaving ? t('common.saving') : t('common.save')}
            </Button>
            <Button variant="outlined" onClick={handleTestConfig} disabled={configTesting}
              sx={{ textTransform: 'none', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {configTesting ? t('jiraTickets.config.testing') : t('jiraTickets.config.testConnection')}
            </Button>
            {jiraConfigured && (
              <Button variant="outlined" color="error" onClick={handleDeleteConfig} sx={{ textTransform: 'none' }}>
                {t('jiraTickets.config.deleteConfig')}
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {/* ── Dialog: 编辑/新增模板 ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { backgroundColor: 'var(--background-paper)', color: 'var(--text-primary)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
          {editingTemplate ? t('jiraTickets.templates.edit') : t('jiraTickets.templates.add')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label={t('jiraTickets.templates.form.name')} fullWidth value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} sx={textFieldSx} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.templates.form.category')}</InputLabel>
            <Select label={t('jiraTickets.templates.form.category')} value={formData.category}
              onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} sx={selectSx}>
              {['daily', 'weekly', 'monthly', 'support', 'custom'].map((v) =>
                <MenuItem key={v} value={v} sx={{ color: 'var(--text-primary)' }}>{getCategoryLabel(v)}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'var(--text-secondary)' }}>Component</InputLabel>
            <Select label="Component" value={formData.componentId}
              onChange={e => {
                const val = e.target.value;
                setFormData(p => ({ ...p, componentId: val, internalComponentCategory: '', internalComponentSubCategory: '', internalComponentCategoryId: '', internalComponentSubCategoryId: '' }));
                loadInternalComponentOptions(val);
              }} sx={selectSx}>
              {Object.entries(COMPONENT_NAMES).map(([id, name]) =>
                <MenuItem key={id} value={id} sx={{ color: 'var(--text-primary)' }}>{name}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Internal Component - 级联下拉选择，选项来自 Jira */}
          {(() => {
            const opts = internalComponentOptions?.options || [];
            const selectedParent = opts.find(o => o.id === formData.internalComponentCategoryId) || null;
            const childOpts = selectedParent?.children || [];
            if (opts.length > 0) {
              return (
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: 'var(--text-secondary)' }}>Internal Component（类别）</InputLabel>
                    <Select
                      label="Internal Component（类别）"
                      value={formData.internalComponentCategoryId || ''}
                      onChange={e => {
                        const opt = opts.find(o => o.id === e.target.value);
                        setFormData(p => ({
                          ...p,
                          internalComponentCategoryId: e.target.value,
                          internalComponentCategory: opt?.value || '',
                          internalComponentSubCategoryId: '',
                          internalComponentSubCategory: '',
                        }));
                      }}
                      sx={selectSx}
                    >
                      <MenuItem value="" sx={{ color: 'var(--text-secondary)' }}><em>不选择</em></MenuItem>
                      {opts.map(o => (
                        <MenuItem key={o.id} value={o.id} sx={{ color: 'var(--text-primary)' }}>{o.value}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: 'var(--text-secondary)' }}>Internal Component（子类）</InputLabel>
                    <Select
                      label="Internal Component（子类）"
                      value={formData.internalComponentSubCategoryId || ''}
                      disabled={childOpts.length === 0}
                      onChange={e => {
                        const child = childOpts.find(c => c.id === e.target.value);
                        setFormData(p => ({
                          ...p,
                          internalComponentSubCategoryId: e.target.value,
                          internalComponentSubCategory: child?.value || '',
                        }));
                      }}
                      sx={selectSx}
                    >
                      <MenuItem value="" sx={{ color: 'var(--text-secondary)' }}><em>不选择</em></MenuItem>
                      {childOpts.map(c => (
                        <MenuItem key={c.id} value={c.id} sx={{ color: 'var(--text-primary)' }}>{c.value}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              );
            }
            return (
              <Stack spacing={2}>
                <TextField
                  label="Internal Component（类别）"
                  fullWidth
                  value={formData.internalComponentCategory || ''}
                  helperText="请先选择 Component；系统会自动从历史关单检测并填入"
                  onChange={e => setFormData(p => ({ ...p, internalComponentCategory: e.target.value }))}
                  sx={textFieldSx}
                />
                <TextField
                  label="Internal Component（子类）"
                  fullWidth
                  value={formData.internalComponentSubCategory || ''}
                  helperText="可选"
                  onChange={e => setFormData(p => ({ ...p, internalComponentSubCategory: e.target.value }))}
                  sx={textFieldSx}
                />
              </Stack>
            );
          })()}
          <TextField label={t('jiraTickets.templates.form.summaryTemplate')} fullWidth value={formData.summaryTemplate}
            helperText={t('jiraTickets.templates.form.summaryHelp')}
            onChange={e => setFormData(p => ({ ...p, summaryTemplate: e.target.value }))} sx={textFieldSx} />
          <TextField label={t('jiraTickets.templates.form.descriptionTemplate')} fullWidth multiline rows={3} value={formData.descriptionTemplate}
            onChange={e => setFormData(p => ({ ...p, descriptionTemplate: e.target.value }))} sx={textFieldSx} />
          <TextField label={t('jiraTickets.templates.form.inputsJson')} fullWidth multiline rows={3} value={inputsJson}
            helperText={t('jiraTickets.templates.form.inputsHelp')}
            onChange={e => setInputsJson(e.target.value)} sx={textFieldSx} />
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid var(--border-color)', px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveTemplate} disabled={saving} sx={primaryBtn}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: 删除确认 ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        PaperProps={{ sx: { backgroundColor: 'var(--background-paper)', color: 'var(--text-primary)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)' }}>{t('jiraTickets.deleteConfirm.title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.deleteConfirm.message')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={() => handleDelete(deleteConfirm)}
            sx={{ textTransform: 'none' }}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: 添加评论 ──────────────────────────────────────────────── */}
      <Dialog open={commentOpen} onClose={() => setCommentOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { backgroundColor: 'var(--background-paper)', color: 'var(--text-primary)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
          {t('jiraTickets.commentDialog.title', { key: ticketInfo?.key || '' })}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', gap: 2 }}>
          {/* Left: comment input */}
          <Box sx={{ flex: '2 1 0', minWidth: 0 }}>
            <TextField fullWidth multiline rows={7} label={t('jiraTickets.commentDialog.content')}
              value={commentText} onChange={e => setCommentText(e.target.value)}
              autoFocus sx={textFieldSx} />
          </Box>
          {/* Right: templates panel */}
          <Box sx={{ flex: '1 1 0', minWidth: 180, maxWidth: 260, borderLeft: '1px solid var(--border-color)', pl: 2, display: 'flex', flexDirection: 'column', maxHeight: 250, overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.78rem', mb: 1 }}>
              {t('jiraTickets.commentDialog.templates')}
            </Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 160, minHeight: 80 }}>
              {commentTemplates.length === 0 && !commentTplEditing && (
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.75rem', py: 1 }}>
                  {t('jiraTickets.commentDialog.noTemplates')}
                </Typography>
              )}
              {commentTemplates.map((tpl) => {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Administrator';
                const canDelete = isAdmin || tpl.createdBy === currentUser?.username;
                return (
                  <Box key={tpl.id} sx={{
                    display: 'flex', alignItems: 'center', px: 1, py: 0.5, mb: 0.25, borderRadius: 1,
                    cursor: 'pointer', transition: 'background-color 0.15s',
                    '&:hover': { backgroundColor: 'rgba(100, 108, 255, 0.06)' },
                  }}
                    onClick={() => setCommentText(prev => prev ? prev + '\n' + tpl.text : tpl.text)}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {tpl.text}
                    </Typography>
                    {canDelete && (
                      <IconButton size="small" onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await axios.delete(`${API}/comment-templates/${tpl.id}`, { headers: authHeader() });
                          setCommentTemplates(prev => prev.filter(t => t.id !== tpl.id));
                        } catch { /* ignore */ }
                      }} sx={{ ml: 0.5, p: 0.25, color: 'var(--text-secondary)', opacity: 0.3, '&:hover': { opacity: 1, color: 'var(--error-color)' } }}>
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>
            {commentTplEditing ? (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                <TextField size="small" fullWidth value={commentTplInput}
                  onChange={e => setCommentTplInput(e.target.value)}
                  placeholder={t('jiraTickets.commentDialog.templatePlaceholder')}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && commentTplInput.trim()) {
                      try {
                        const { data } = await axios.post(`${API}/comment-templates`, { text: commentTplInput.trim() }, { headers: authHeader() });
                        if (data.success) setCommentTemplates(prev => [...prev, data.data]);
                      } catch { /* ignore */ }
                      setCommentTplInput(''); setCommentTplEditing(false);
                    }
                    if (e.key === 'Escape') { setCommentTplEditing(false); setCommentTplInput(''); }
                  }}
                  autoFocus
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }} />
                <Button size="small" variant="contained"
                  disabled={!commentTplInput.trim()}
                  onClick={async () => {
                    if (!commentTplInput.trim()) return;
                    try {
                      const { data } = await axios.post(`${API}/comment-templates`, { text: commentTplInput.trim() }, { headers: authHeader() });
                      if (data.success) setCommentTemplates(prev => [...prev, data.data]);
                    } catch { /* ignore */ }
                    setCommentTplInput(''); setCommentTplEditing(false);
                  }}
                  sx={{ ...primaryBtn, minWidth: 'auto', px: 1, fontSize: '0.7rem' }}>
                  {t('jiraTickets.commentDialog.add')}
                </Button>
              </Box>
            ) : (
              <Button size="small" onClick={() => setCommentTplEditing(true)}
                sx={{ mt: 0.5, textTransform: 'none', fontSize: '0.72rem', color: 'var(--primary-color)', alignSelf: 'flex-start' }}>
                {t('jiraTickets.commentDialog.addTemplate')}
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid var(--border-color)', px: 3, py: 2 }}>
          <Button onClick={() => setCommentOpen(false)} sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddComment}
            disabled={commentSaving || !commentText.trim()}
            startIcon={commentSaving ? <CircularProgress size={14} color="inherit" /> : <Send />}
            sx={primaryBtn}>
            {commentSaving ? t('jiraTickets.commentDialog.submitting') : t('jiraTickets.commentDialog.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Transition ────────────────────────────────────────────── */}
      <Dialog open={transitionOpen} onClose={() => !transitionSaving && setTransitionOpen(false)}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { backgroundColor: 'var(--background-paper)', color: 'var(--text-primary)' } }}>
        <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{activeTransition?.name}</span>
            {activeTransition?.toStatus && (
              <Typography component="span" variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                → {activeTransition.toStatus}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {transitionResult && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {transitionResult.message}
            </Alert>
          )}
          {activeTransition && Object.keys(activeTransition.fields).length === 0 && (
            <Typography sx={{ color: 'var(--text-secondary)' }}>{t('jiraTickets.transitionDialog.confirmAction')}</Typography>
          )}
          {activeTransition && Object.entries(activeTransition.fields).map(([fieldId, fieldDef]) =>
            renderTransitionField(fieldId, fieldDef)
          )}
        </DialogContent>
        {!transitionResult && (
          <DialogActions sx={{ borderTop: '1px solid var(--border-color)', px: 3, py: 2 }}>
            <Button onClick={() => setTransitionOpen(false)} disabled={transitionSaving}
              sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}>{t('common.cancel')}</Button>
            <Button variant="contained"
              color={activeTransition?.toStatus === 'Closed' || activeTransition?.toStatus === 'Resolved' ? 'success' : 'primary'}
              onClick={handleDoTransition} disabled={transitionSaving}
              startIcon={transitionSaving ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
              sx={{ textTransform: 'none', fontWeight: 600 }}>
              {transitionSaving ? t('jiraTickets.transitionDialog.executing') : t('common.confirm')}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}
