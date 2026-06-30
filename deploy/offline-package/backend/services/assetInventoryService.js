const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SESSIONS_DIR = path.join(__dirname, '../config/assetInventorySessions');
const SESSIONS_INDEX_FILE = path.join(SESSIONS_DIR, '_index.json');

// Ensure sessions directory exists
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

const DEFAULT_SESSION_DATA = {
  currentStep: 0,
  inventoryMode: null,
  inventoryPerson: '',
  inventoryPersonList: [],
  currentInventoryPerson: '',
  baselineData: [],
  scannedAssets: [],
  notFoundAssets: [],
  locationMismatches: [],
  scanHistory: [],
  inventoryStartTime: null,
  inventoryEndTime: null,
  inUseLocationPresetEnabled: false,
  selectedPresetLocation: null
};

const DEFAULT_ASSET_FIELDS = {
  lifecycleStatus: 'in_stock',
  owner: '',
  location: '',
  dataSource: 'manual',
  lastVerifiedAt: null,
  notes: ''
};

function normalizeAssetRecord(record) {
  if (!record || typeof record !== 'object') {
    return { ...DEFAULT_ASSET_FIELDS };
  }
  return {
    ...record,
    lifecycleStatus: record.lifecycleStatus || DEFAULT_ASSET_FIELDS.lifecycleStatus,
    owner: record.owner || DEFAULT_ASSET_FIELDS.owner,
    location: record.location || record.department || DEFAULT_ASSET_FIELDS.location,
    dataSource: record.dataSource || DEFAULT_ASSET_FIELDS.dataSource,
    lastVerifiedAt: record.lastVerifiedAt || null,
    notes: record.notes || DEFAULT_ASSET_FIELDS.notes
  };
}

function normalizeInventoryPayload(data) {
  const payload = { ...DEFAULT_SESSION_DATA, ...(data || {}) };
  payload.baselineData = Array.isArray(payload.baselineData)
    ? payload.baselineData.map(normalizeAssetRecord)
    : [];
  payload.scannedAssets = Array.isArray(payload.scannedAssets)
    ? payload.scannedAssets.map(normalizeAssetRecord)
    : [];
  payload.notFoundAssets = Array.isArray(payload.notFoundAssets)
    ? payload.notFoundAssets.map(normalizeAssetRecord)
    : [];
  payload.locationMismatches = Array.isArray(payload.locationMismatches)
    ? payload.locationMismatches.map(item => ({
      ...item,
      asset: normalizeAssetRecord(item.asset || item)
    }))
    : [];
  return payload;
}

// --- Sessions Index ---

function getSessionsIndex() {
  ensureSessionsDir();
  try {
    if (fs.existsSync(SESSIONS_INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_INDEX_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading sessions index:', error.message);
  }
  return [];
}

function saveSessionsIndex(index) {
  ensureSessionsDir();
  fs.writeFileSync(SESSIONS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

// --- Session CRUD ---

function createSession({ name, createdBy }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session = {
    id,
    name: name || `盘点任务 ${now.slice(0, 10)}`,
    createdBy: createdBy || 'Unknown',
    createdAt: now,
    updatedAt: now,
    status: 'active' // active | completed
  };

  // Save session metadata to index
  const index = getSessionsIndex();
  index.unshift(session);
  saveSessionsIndex(index);

  // Save empty session data
  const dataFile = path.join(SESSIONS_DIR, `${id}.json`);
  fs.writeFileSync(dataFile, JSON.stringify({ ...DEFAULT_SESSION_DATA }, null, 2), 'utf8');

  return session;
}

function listSessions() {
  return getSessionsIndex();
}

function getSession(id) {
  const index = getSessionsIndex();
  const meta = index.find(s => s.id === id);
  if (!meta) return null;
  return meta;
}

function getSessionData(id) {
  ensureSessionsDir();
  const dataFile = path.join(SESSIONS_DIR, `${id}.json`);
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, 'utf8');
      return normalizeInventoryPayload(JSON.parse(data));
    }
  } catch (error) {
    console.error(`Error reading session ${id}:`, error.message);
  }
  return null;
}

function saveSessionData(id, data) {
  ensureSessionsDir();
  const dataFile = path.join(SESSIONS_DIR, `${id}.json`);
  const normalized = normalizeInventoryPayload(data);
  fs.writeFileSync(dataFile, JSON.stringify(normalized, null, 2), 'utf8');

  // Update timestamp in index
  const index = getSessionsIndex();
  const session = index.find(s => s.id === id);
  if (session) {
    session.updatedAt = new Date().toISOString();
    // Auto-detect completion
    if (normalized.currentStep === 3 && normalized.inventoryEndTime) {
      session.status = 'completed';
    }
    saveSessionsIndex(index);
  }

  return normalized;
}

function deleteSession(id) {
  ensureSessionsDir();
  // Remove data file
  const dataFile = path.join(SESSIONS_DIR, `${id}.json`);
  if (fs.existsSync(dataFile)) {
    fs.unlinkSync(dataFile);
  }
  // Remove from index
  let index = getSessionsIndex();
  index = index.filter(s => s.id !== id);
  saveSessionsIndex(index);
  return true;
}

function resetSessionData(id) {
  const data = { ...DEFAULT_SESSION_DATA };
  saveSessionData(id, data);
  return data;
}

// --- Legacy single-session API (backward compatible) ---
// Maps to a default session for backward compatibility

const LEGACY_FILE = path.join(__dirname, '../config/assetInventory.json');

function getData() {
  try {
    if (fs.existsSync(LEGACY_FILE)) {
      const data = fs.readFileSync(LEGACY_FILE, 'utf8');
      return normalizeInventoryPayload(JSON.parse(data));
    }
  } catch (error) {
    console.error('Error reading asset inventory data:', error.message);
  }
  return normalizeInventoryPayload(DEFAULT_SESSION_DATA);
}

function saveData(data) {
  try {
    const dir = path.dirname(LEGACY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const normalized = normalizeInventoryPayload(data);
    fs.writeFileSync(LEGACY_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (error) {
    console.error('Error saving asset inventory data:', error.message);
    throw error;
  }
}

function resetData() {
  const data = normalizeInventoryPayload(DEFAULT_SESSION_DATA);
  saveData(data);
  return data;
}

module.exports = {
  // Legacy single-session
  getData,
  saveData,
  resetData,
  // Multi-session
  createSession,
  listSessions,
  getSession,
  getSessionData,
  saveSessionData,
  deleteSession,
  resetSessionData
};
