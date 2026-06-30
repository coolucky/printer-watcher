/**
 * API Sync Adapter for Asset Inventory - Multi-Session Support
 * - Manages inventory sessions (create, list, switch, delete)
 * - Each session syncs to backend independently
 * - localStorage key: assetInventoryData (always current session's data)
 * - Session ID stored in: assetInventorySessionId
 */
(function() {
  'use strict';

  const API_URL = '/api/asset-inventory';

  // Get auth token from localStorage (set by main app login)
  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const session = localStorage.getItem('authSession');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.accessToken) {
          headers['Authorization'] = `Bearer ${parsed.accessToken}`;
        }
      }
    } catch (e) {}
    return headers;
  }

  // Get current session ID
  function getCurrentSessionId() {
    return localStorage.getItem('assetInventorySessionId') || null;
  }

  // Set current session ID
  function setCurrentSessionId(id) {
    localStorage.setItem('assetInventorySessionId', id);
  }

  // Load session data from backend
  async function loadSessionData(sessionId) {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.data) {
          localStorage.setItem('assetInventoryData', JSON.stringify(result.data.data));
          console.log('✅ [API Sync] Loaded session data from backend:', sessionId);
          return true;
        }
      }
    } catch (error) {
      console.warn('⚠️ [API Sync] Failed to load session:', error.message);
    }
    return false;
  }

  // Save session data to backend (non-blocking)
  function saveSessionData(sessionId, data) {
    fetch(`${API_URL}/sessions/${sessionId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    }).then(response => {
      if (response.ok) {
        console.log('✅ [API Sync] Session saved to backend');
      }
    }).catch(error => {
      console.warn('⚠️ [API Sync] Backend save error:', error.message);
    });
  }

  // List all sessions
  async function listSessions() {
    try {
      const response = await fetch(`${API_URL}/sessions`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        return result.data || [];
      }
    } catch (error) {
      console.warn('⚠️ [API Sync] Failed to list sessions:', error.message);
    }
    return [];
  }

  // Create new session
  async function createSession(name, createdBy) {
    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, createdBy })
      });
      if (response.ok) {
        const result = await response.json();
        return result.data;
      }
    } catch (error) {
      console.warn('⚠️ [API Sync] Failed to create session:', error.message);
    }
    return null;
  }

  // Delete session
  async function deleteSession(sessionId) {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ [API Sync] Failed to delete session:', error.message);
      return false;
    }
  }

  // Intercept localStorage.setItem for asset inventory data
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key === 'assetInventoryData') {
      const sessionId = getCurrentSessionId();
      if (sessionId) {
        try {
          const data = JSON.parse(value);
          saveSessionData(sessionId, data);
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  };

  localStorage.removeItem = function(key) {
    originalRemoveItem(key);
    if (key === 'assetInventoryData') {
      // Don't delete session on backend - just local clear
    }
  };

  // Initial load: if there's a current session, load its data
  window._apiSyncReady = (async function() {
    const sessionId = getCurrentSessionId();
    if (sessionId) {
      await loadSessionData(sessionId);
    }
  })();

  // Export session management functions for use by UI
  window.assetInventorySessionManager = {
    getCurrentSessionId,
    setCurrentSessionId,
    loadSessionData,
    saveSessionData,
    listSessions,
    createSession,
    deleteSession
  };

  console.log('📡 [API Sync] Asset inventory multi-session sync adapter loaded');
})();
