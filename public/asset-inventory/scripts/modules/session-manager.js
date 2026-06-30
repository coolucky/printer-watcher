// Session Manager UI for Asset Inventory Multi-Session Support
(function() {
  'use strict';

  const t = (key) => {
    if (window.assetInventoryI18n && window.assetInventoryI18n.t) {
      return window.assetInventoryI18n.t(key);
    }
    return key;
  };

  // Session manager state
  let sessionManagerVisible = false;
  let _originalLoadAssetInventoryModule = null;

  // Format date for display
  function formatDate(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleString();
  }

  // Get status badge HTML
  function getStatusBadge(status) {
    if (status === 'completed') {
      return `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:12px;">✓ ${t('session.status.completed')}</span>`;
    }
    return `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:12px;">● ${t('session.status.active')}</span>`;
  }

  // Render session list panel
  async function renderSessionPanel(container) {
    const sm = window.assetInventorySessionManager;
    if (!sm) {
      console.error('Session manager not available');
      return;
    }

    const sessions = await sm.listSessions();
    const currentSessionId = sm.getCurrentSessionId();
    const isDark = document.body.classList.contains('dark-theme');
    const colors = isDark ? {
      bg: '#1e293b', text: '#e2e8f0', subtext: '#94a3b8',
      cardBg: '#334155', cardBorder: '#475569', activeBg: '#1e3a5f', activeBorder: '#3b82f6',
      hover: 'rgba(255,255,255,0.05)'
    } : {
      bg: '#ffffff', text: '#1e293b', subtext: '#64748b',
      cardBg: '#ffffff', cardBorder: '#e2e8f0', activeBg: '#eff6ff', activeBorder: '#3b82f6',
      hover: 'rgba(0,0,0,0.08)'
    };

    const sessionListHtml = sessions.length === 0 
      ? `<div style="text-align:center;padding:40px 20px;color:${colors.subtext};">
           <div style="font-size:48px;margin-bottom:16px;">📋</div>
           <p style="font-size:16px;">${t('session.empty')}</p>
           <p style="font-size:13px;">${t('session.empty.hint')}</p>
         </div>`
      : sessions.map(s => `
        <div class="session-item ${s.id === currentSessionId ? 'session-active' : ''}" data-session-id="${s.id}" style="
          border: 1px solid ${s.id === currentSessionId ? colors.activeBorder : colors.cardBorder};
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: ${s.id === currentSessionId ? colors.activeBg : colors.cardBg};
          position: relative;
        " onmouseover="this.style.boxShadow='0 4px 12px ${colors.hover}'" onmouseout="this.style.boxShadow='none'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <strong style="font-size:15px;color:${colors.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</strong>
                ${getStatusBadge(s.status)}
                ${s.id === currentSessionId ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;">▶ ' + t('session.current') + '</span>' : ''}
              </div>
              <div style="font-size:12px;color:${colors.subtext};display:flex;gap:16px;flex-wrap:wrap;">
                <span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${escapeHtml(s.createdBy || 'Unknown')}</span>
                <span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${formatDate(s.createdAt)}</span>
                <span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${formatDate(s.updatedAt)}</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px;">
              ${s.id === currentSessionId 
                ? `<button onclick="event.stopPropagation();window._sessionContinue('${s.id}')" style="padding:6px 14px;border:none;border-radius:6px;background:#3b82f6;color:white;cursor:pointer;font-size:13px;" title="${t('session.continue')}">${t('session.continue')}</button>`
                : `<button onclick="event.stopPropagation();window._sessionSwitch('${s.id}')" style="padding:6px 14px;border:none;border-radius:6px;background:#10b981;color:white;cursor:pointer;font-size:13px;" title="${t('session.open')}">${t('session.open')}</button>`
              }
              <button onclick="event.stopPropagation();window._sessionDelete('${s.id}','${escapeHtml(s.name)}')" style="padding:6px 10px;border:none;border-radius:6px;background:#fee2e2;color:#dc2626;cursor:pointer;font-size:13px;" title="${t('session.delete')}">🗑</button>
            </div>
          </div>
        </div>
      `).join('');

    container.innerHTML = `
      <div class="session-manager-panel" style="max-width:900px;margin:0 auto;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div>
              <h2 style="margin:0;color:${colors.text};font-size:24px;font-weight:700;">${t('session.title')}</h2>
              <p style="margin:4px 0 0;color:${colors.subtext};font-size:14px;">${t('session.subtitle')}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button onclick="window._sessionCreate()" style="
            padding:10px 20px;
            border:none;
            border-radius:8px;
            background:linear-gradient(135deg,#3b82f6,#2563eb);
            color:white;
            font-size:14px;
            font-weight:600;
            cursor:pointer;
            display:flex;
            align-items:center;
            gap:6px;
            box-shadow:0 4px 12px rgba(59,130,246,0.3);
            transition:all 0.2s;
          " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            ➕ ${t('session.create')}
          </button>
          <button onclick="window._sessionBack()" style="
            padding:10px 16px;
            border:1px solid ${colors.cardBorder};
            border-radius:8px;
            background:${colors.cardBg};
            color:${colors.text};
            font-size:14px;
            cursor:pointer;
            display:flex;
            align-items:center;
            gap:4px;
            transition:all 0.2s;
          " onmouseover="this.style.background='${colors.hover}'" onmouseout="this.style.background='${colors.cardBg}'">
            ← ${t('session.back')}
          </button>
          </div>
        </div>
        
        <div id="session-list-container">
          ${sessionListHtml}
        </div>
      </div>
    `;
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // --- Global event handlers ---

  // Create new session - show inline form
  window._sessionCreate = function() {
    const existingForm = document.getElementById('session-create-form');
    if (existingForm) {
      existingForm.querySelector('input')?.focus();
      return;
    }

    const isDark = document.body.classList.contains('dark-theme');
    const colors = isDark ? {
      bg: '#334155', border: '#475569', text: '#e2e8f0', inputBg: '#1e293b', inputBorder: '#475569'
    } : {
      bg: '#f0f9ff', border: '#bae6fd', text: '#1e293b', inputBg: '#ffffff', inputBorder: '#cbd5e1'
    };

    // Get current user's Full Name from localStorage
    let currentUserFullName = '';
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        currentUserFullName = user.ntid || user.username || '';
      }
    } catch(e) {}

    const dateStr = new Date().toLocaleDateString();
    const defaultPlaceholder = `${t('session.default_name')} ${dateStr}`;

    const form = document.createElement('div');
    form.id = 'session-create-form';
    form.style.cssText = `border:2px solid ${colors.border};border-radius:12px;padding:20px;margin-bottom:16px;background:${colors.bg};animation:slideDown 0.2s ease;`;
    form.innerHTML = `
      <style>@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}</style>
      <h3 style="margin:0 0 16px;font-size:16px;color:${colors.text};">➕ ${t('session.create')}</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
            <label style="font-size:13px;color:${colors.text};font-weight:500;white-space:nowrap;">${t('session.create.location_prompt')}</label>
            <div style="display:flex;gap:8px;">
              <button type="button" class="session-location-btn" data-location="Beijing" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.beijing')}</button>
              <button type="button" class="session-location-btn" data-location="Shanghai" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.shanghai')}</button>
              <button type="button" class="session-location-btn" data-location="Shenzhen" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.shenzhen')}</button>
            </div>
          </div>
          <input type="text" id="session-name-input" placeholder="${defaultPlaceholder}" style="width:100%;padding:8px 12px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:#9ca3af;font-size:14px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="display:block;font-size:13px;color:${colors.text};margin-bottom:4px;font-weight:500;">${t('session.create.person_prompt')}</label>
          <input type="text" id="session-person-input" value="${escapeHtml(currentUserFullName)}" style="width:100%;padding:8px 12px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};font-size:14px;box-sizing:border-box;" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button onclick="document.getElementById('session-create-form')?.remove()" style="padding:8px 16px;border:1px solid ${colors.inputBorder};border-radius:6px;background:transparent;color:${colors.text};cursor:pointer;font-size:13px;">✕</button>
          <button id="session-create-confirm-btn" style="padding:8px 20px;border:none;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;cursor:pointer;font-size:13px;font-weight:600;">✓ ${t('session.create')}</button>
        </div>
      </div>
    `;

    const listContainer = document.getElementById('session-list-container');
    if (listContainer) {
      listContainer.insertBefore(form, listContainer.firstChild);
    }

    // Handle location button clicks
    const locationBtns = form.querySelectorAll('.session-location-btn');
    locationBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        // Remove active state from all buttons
        locationBtns.forEach(b => {
          b.style.background = colors.inputBg;
          b.style.borderColor = colors.inputBorder;
          b.style.color = colors.text;
        });
        // Set active state
        this.style.background = 'linear-gradient(135deg,#3b82f6,#2563eb)';
        this.style.borderColor = '#2563eb';
        this.style.color = 'white';
        // Auto-fill name input
        const locationLabel = this.textContent.trim();
        const nameInput = document.getElementById('session-name-input');
        if (nameInput) {
          nameInput.value = `${locationLabel} ${t('session.default_name')} ${dateStr}`;
          nameInput.style.color = colors.text;
        }
      });
    });

    // Handle Enter key
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('session-create-confirm-btn')?.click();
      } else if (e.key === 'Escape') {
        form.remove();
      }
    });

    // Handle confirm
    document.getElementById('session-create-confirm-btn').onclick = async function() {
      const name = document.getElementById('session-name-input')?.value?.trim();
      const createdBy = document.getElementById('session-person-input')?.value?.trim();

      const sm = window.assetInventorySessionManager;
      const session = await sm.createSession(name || undefined, createdBy || undefined);
      if (session) {
        sm.setCurrentSessionId(session.id);
        localStorage.setItem('assetInventoryData', JSON.stringify({
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
        }));
        window.assetInventoryData = JSON.parse(localStorage.getItem('assetInventoryData'));
        window.loadAssetInventoryModule(window._inventoryContainer);
      }
    };
  };

  // Switch to existing session
  window._sessionSwitch = async function(sessionId) {
    const sm = window.assetInventorySessionManager;
    sm.setCurrentSessionId(sessionId);
    const loaded = await sm.loadSessionData(sessionId);
    if (loaded) {
      window.assetInventoryData = JSON.parse(localStorage.getItem('assetInventoryData'));
      window.loadAssetInventoryModule(window._inventoryContainer);
    }
  };

  // Continue current session
  window._sessionContinue = function(sessionId) {
    window.loadAssetInventoryModule(window._inventoryContainer);
  };

  // Back to inventory (from task list)
  window._sessionBack = function() {
    const container = window._inventoryContainer || document.getElementById('content-body');
    if (_originalLoadAssetInventoryModule && container) {
      _originalLoadAssetInventoryModule(container);
      addSessionHeaderBar();
    } else if (typeof window.loadAssetInventory === 'function') {
      window.loadAssetInventory();
    }
  };

  // Create new session from main inventory page (shows form inline above inventory module)
  window._sessionCreateInline = function() {
    // If already on session manager page, just call the regular create
    if (document.querySelector('.session-manager-panel')) {
      window._sessionCreate();
      return;
    }

    const existingForm = document.getElementById('session-create-inline-form');
    if (existingForm) {
      existingForm.querySelector('input')?.focus();
      return;
    }

    const isDark = document.body.classList.contains('dark-theme');
    const colors = isDark ? {
      bg: '#334155', border: '#475569', text: '#e2e8f0', inputBg: '#1e293b', inputBorder: '#475569'
    } : {
      bg: '#f0f9ff', border: '#bae6fd', text: '#1e293b', inputBg: '#ffffff', inputBorder: '#cbd5e1'
    };

    let currentUserFullName = '';
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        currentUserFullName = user.ntid || user.username || '';
      }
    } catch(e) {}

    const dateStr = new Date().toLocaleDateString();
    const defaultPlaceholder = `${t('session.default_name')} ${dateStr}`;

    const form = document.createElement('div');
    form.id = 'session-create-inline-form';
    form.style.cssText = `border:2px solid ${colors.border};border-radius:12px;padding:20px;margin-bottom:12px;background:${colors.bg};animation:slideDown 0.2s ease;`;
    form.innerHTML = `
      <style>@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}</style>
      <h3 style="margin:0 0 16px;font-size:16px;color:${colors.text};">➕ ${t('session.create')}</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
            <label style="font-size:13px;color:${colors.text};font-weight:500;white-space:nowrap;">${t('session.create.location_prompt')}</label>
            <div style="display:flex;gap:8px;">
              <button type="button" class="session-location-btn-inline" data-location="Beijing" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.beijing')}</button>
              <button type="button" class="session-location-btn-inline" data-location="Shanghai" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.shanghai')}</button>
              <button type="button" class="session-location-btn-inline" data-location="Shenzhen" style="padding:6px 14px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">${t('session.location.shenzhen')}</button>
            </div>
          </div>
          <input type="text" id="session-name-inline-input" placeholder="${defaultPlaceholder}" style="width:100%;padding:8px 12px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:#9ca3af;font-size:14px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="display:block;font-size:13px;color:${colors.text};margin-bottom:4px;font-weight:500;">${t('session.create.person_prompt')}</label>
          <input type="text" id="session-person-inline-input" value="${escapeHtml(currentUserFullName)}" style="width:100%;padding:8px 12px;border:1px solid ${colors.inputBorder};border-radius:6px;background:${colors.inputBg};color:${colors.text};font-size:14px;box-sizing:border-box;" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button id="session-create-inline-cancel" style="padding:8px 16px;border:1px solid ${colors.inputBorder};border-radius:6px;background:transparent;color:${colors.text};cursor:pointer;font-size:13px;">✕</button>
          <button id="session-create-inline-confirm" style="padding:8px 20px;border:none;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;cursor:pointer;font-size:13px;font-weight:600;">✓ ${t('session.create')}</button>
        </div>
      </div>
    `;

    // Insert above the inventory module
    const moduleEl = document.querySelector('.inventory-module');
    if (moduleEl) {
      moduleEl.insertBefore(form, moduleEl.children[1] || moduleEl.firstChild);
    }

    // Handle location button clicks
    const locationBtns = form.querySelectorAll('.session-location-btn-inline');
    locationBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        locationBtns.forEach(b => {
          b.style.background = colors.inputBg;
          b.style.borderColor = colors.inputBorder;
          b.style.color = colors.text;
        });
        this.style.background = 'linear-gradient(135deg,#3b82f6,#2563eb)';
        this.style.borderColor = '#2563eb';
        this.style.color = 'white';
        const locationLabel = this.textContent.trim();
        const nameInput = document.getElementById('session-name-inline-input');
        if (nameInput) {
          nameInput.value = `${locationLabel} ${t('session.default_name')} ${dateStr}`;
          nameInput.style.color = colors.text;
        }
        // Clear location required hint
        const hint = form.querySelector('.location-required-hint');
        if (hint) hint.remove();
      });
    });

    // Cancel
    document.getElementById('session-create-inline-cancel').onclick = () => form.remove();

    // Enter/Escape
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('session-create-inline-confirm')?.click();
      } else if (e.key === 'Escape') {
        form.remove();
      }
    });

    // Confirm
    document.getElementById('session-create-inline-confirm').onclick = async function() {
      // Validate location selection (required)
      const selectedLocationBtn = form.querySelector('.session-location-btn-inline[style*="linear-gradient"]');
      if (!selectedLocationBtn) {
        // Highlight location buttons with error style
        const locationBtns = form.querySelectorAll('.session-location-btn-inline');
        locationBtns.forEach(btn => {
          btn.style.borderColor = '#ef4444';
          btn.style.animation = 'shake 0.3s ease';
        });
        // Show hint
        let hint = form.querySelector('.location-required-hint');
        if (!hint) {
          hint = document.createElement('span');
          hint.className = 'location-required-hint';
          hint.style.cssText = 'color:#ef4444;font-size:12px;font-weight:500;margin-left:8px;';
          hint.textContent = '⚠️ ' + (t('session.create.location_required') || 'Please select a location');
          const labelEl = form.querySelector('label[style*="white-space:nowrap"]');
          if (labelEl) labelEl.parentNode.appendChild(hint);
        }
        // Add shake animation
        if (!document.getElementById('shake-animation-style')) {
          const shakeStyle = document.createElement('style');
          shakeStyle.id = 'shake-animation-style';
          shakeStyle.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
          document.head.appendChild(shakeStyle);
        }
        setTimeout(() => locationBtns.forEach(btn => btn.style.animation = ''), 300);
        return;
      }

      const name = document.getElementById('session-name-inline-input')?.value?.trim();
      const createdBy = document.getElementById('session-person-inline-input')?.value?.trim();

      const sm = window.assetInventorySessionManager;
      const session = await sm.createSession(name || undefined, createdBy || undefined);
      if (session) {
        sm.setCurrentSessionId(session.id);
        localStorage.setItem('assetInventoryData', JSON.stringify({
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
        }));
        window.assetInventoryData = JSON.parse(localStorage.getItem('assetInventoryData'));
        window.loadAssetInventoryModule(window._inventoryContainer);
      }
    };
  };

  // Delete session
  window._sessionDelete = async function(sessionId, name) {
    const t_fn = window.assetInventoryI18n?.t || t;
    if (!confirm(t_fn('session.delete.confirm').replace('{name}', name))) return;
    
    const sm = window.assetInventorySessionManager;
    const currentId = sm.getCurrentSessionId();
    await sm.deleteSession(sessionId);
    
    // If deleted current session, clear it
    if (currentId === sessionId) {
      localStorage.removeItem('assetInventorySessionId');
      localStorage.removeItem('assetInventoryData');
      window.assetInventoryData = null;
    }
    
    // Re-render session panel
    window.showSessionManager();
  };

  // Show session manager panel
  window.showSessionManager = function() {
    sessionManagerVisible = true;
    // Remove the header bar since Task Manager has its own buttons
    const headerBar = document.getElementById('session-header-bar');
    if (headerBar) headerBar.remove();
    
    let contentArea = window._inventoryContainer ||
                      document.getElementById('content-body') || 
                      document.getElementById('content-area') || 
                      document.querySelector('.content-body');
    if (!contentArea) {
      contentArea = document.querySelector('.inventory-module')?.parentElement;
    }
    if (contentArea) {
      renderSessionPanel(contentArea);
    }
  };

  // Override loadAssetInventoryModule to add session header bar
  
  // Wait for the original to be defined, then wrap it
  function wrapLoadModule() {
    if (!window.loadAssetInventoryModule) {
      setTimeout(wrapLoadModule, 50);
      return;
    }
    
    _originalLoadAssetInventoryModule = window.loadAssetInventoryModule;
    
    window.loadAssetInventoryModule = function(container) {
      // Store container reference for later use
      if (container) window._inventoryContainer = container;
      
      // Always load the original inventory module (default page)
      _originalLoadAssetInventoryModule(container || window._inventoryContainer);
      
      // Add session header bar after module loads
      addSessionHeaderBar();
    };
    
    console.log('✅ [Session Manager] loadAssetInventoryModule wrapped');
  }

  // Wrap immediately since session-manager.js loads after asset-inventory.js
  wrapLoadModule();

  function addSessionHeaderBar() {
    const sm = window.assetInventorySessionManager;
    if (!sm) return;

    // Don't show header bar on the session manager (Task List) page
    if (document.querySelector('.session-manager-panel')) return;

    // Check if bar already exists
    if (document.getElementById('session-header-bar')) return;

    const sessionId = sm.getCurrentSessionId();
    const isDark = document.body.classList.contains('dark-theme');

    if (sessionId) {
      // Get session meta to show name
      const authHeaders = {};
      try {
        const session = localStorage.getItem('authSession');
        if (session) {
          const parsed = JSON.parse(session);
          if (parsed.accessToken) authHeaders['Authorization'] = `Bearer ${parsed.accessToken}`;
        }
      } catch(e) {}
      fetch(`/api/asset-inventory/sessions/${sessionId}`, { headers: authHeaders })
        .then(r => r.json())
        .then(result => {
          const meta = result.success ? result.data : { name: 'Session', status: 'in-progress', createdBy: '' };
          if (document.getElementById('session-header-bar')) return;
          renderHeaderBar(meta, isDark);
        })
        .catch(() => {
          if (document.getElementById('session-header-bar')) return;
          renderHeaderBar({ name: 'Session', status: 'in-progress', createdBy: '' }, isDark);
        });
    } else {
      renderHeaderBar(null, isDark);
    }
  }

  function renderHeaderBar(meta, isDark) {
    const barBg = isDark ? '#334155' : '#f1f5f9';
    const barColor = isDark ? '#e2e8f0' : '#475569';
    const btnBg = isDark ? '#1e293b' : 'white';
    const btnBorder = isDark ? '#475569' : '#cbd5e1';
    
    const bar = document.createElement('div');
    bar.id = 'session-header-bar';
    bar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:${barBg};border-radius:8px;margin-bottom:12px;font-size:13px;color:${barColor};`;
    
    const leftContent = meta
      ? `<div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;">📋 ${escapeHtml(meta.name || 'Session')}</span>
          ${getStatusBadge(meta.status)}
          <span style="color:#94a3b8;">|</span>
          <span>👤 ${escapeHtml(meta.createdBy || '')}</span>
        </div>`
      : `<div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:600;color:#94a3b8;">📋 ${t('session.empty.hint') || 'No active task'}</span>
        </div>`;
    
    bar.innerHTML = `
      ${leftContent}
      <div style="display:flex;gap:8px;">
        <button onclick="window._sessionCreateInline()" style="padding:5px 12px;border:none;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;">
          ➕ ${t('session.create')}
        </button>
        <button onclick="window.showSessionManager()" style="padding:5px 12px;border:1px solid ${btnBorder};border-radius:6px;background:${btnBg};color:${barColor};cursor:pointer;font-size:12px;transition:all 0.2s;">
          📋 ${t('session.switch')}
        </button>
      </div>
    `;
    
    const moduleEl = document.querySelector('.inventory-module') ||
                     window._inventoryContainer ||
                     document.getElementById('content-body');
    if (moduleEl) {
      moduleEl.insertBefore(bar, moduleEl.firstChild);
    }
  }

  console.log('📋 [Session Manager] UI module loaded');
})();
