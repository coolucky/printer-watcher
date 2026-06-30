import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context';

/**
 * AssetInventory Component
 * Embeds the standalone asset inventory tool directly in the DOM
 * (no iframe) so that elements can be inspected and selected in VS Code.
 * Syncs language and theme with parent app.
 */
const AssetInventory = () => {
  const containerRef = useRef(null);
  const { i18n } = useTranslation();
  const { state } = useAppContext();
  const scriptsLoadedRef = useRef(false);

  // Load CSS and scripts directly into the page
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create the DOM structure
    container.innerHTML = `
      <div class="app-container">
        <main class="main-content" style="margin-left: 0;">
          <div class="content-wrapper">
            <div class="content-body" id="content-body"></div>
          </div>
        </main>
      </div>
      <div class="notification" id="notification">
        <div class="notification-content">
          <span class="notification-icon"></span>
          <span class="notification-message"></span>
        </div>
      </div>
    `;

    // If scripts were already loaded (re-mount), just reinitialize
    if (scriptsLoadedRef.current) {
      setTimeout(() => {
        if (typeof window.loadAssetInventory === 'function') {
          window.loadAssetInventory();
        } else if (typeof window.loadAssetInventoryModule === 'function') {
          const contentBody = document.getElementById('content-body');
          if (contentBody) {
            window.loadAssetInventoryModule(contentBody);
          }
        }
      }, 50);
      return;
    }

    scriptsLoadedRef.current = true;

    // Add CSS
    if (!document.getElementById('asset-inventory-css')) {
      const link = document.createElement('link');
      link.id = 'asset-inventory-css';
      link.rel = 'stylesheet';
      link.href = '/asset-inventory/styles/main.css?v=20251223-1728';
      document.head.appendChild(link);
    }

    // Add overrides to prevent asset-inventory CSS from breaking global layout
    if (!document.getElementById('asset-inventory-dark-styles')) {
      const style = document.createElement('style');
      style.id = 'asset-inventory-dark-styles';
      style.textContent = `
        /* Override global styles leaked from asset-inventory main.css */
        body { overflow: auto !important; }
        .app-container:not(#asset-inventory-container .app-container) { height: auto !important; }
        #asset-inventory-container { overflow: auto; }
        #asset-inventory-container .app-container { height: auto !important; min-height: auto; }
        body.dark-theme #asset-inventory-container .main-content { background-color: #1a1a2e !important; }
        body.dark-theme #asset-inventory-container .content-wrapper { background-color: #1e293b !important; }
        body.dark-theme #asset-inventory-container .content-body { color: #e0e0e0 !important; }
        body.dark-theme #asset-inventory-container .card,
        body.dark-theme #asset-inventory-container .stats-card,
        body.dark-theme #asset-inventory-container .mode-card,
        body.dark-theme #asset-inventory-container .upload-area,
        body.dark-theme #asset-inventory-container .scan-section,
        body.dark-theme #asset-inventory-container .report-section {
          background-color: #2d3748 !important;
          border-color: #4a5568 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme #asset-inventory-container .step-indicator .step {
          background-color: #2d3748 !important;
          border-color: #4a5568 !important;
          color: #a0aec0 !important;
        }
        body.dark-theme #asset-inventory-container .step-indicator .step.active {
          background-color: #4338ca !important;
          border-color: #4338ca !important;
          color: #fff !important;
        }
        body.dark-theme #asset-inventory-container .stats-summary {
          background-color: #2d3748 !important;
          border-color: #4a5568 !important;
        }
        body.dark-theme #asset-inventory-container .stats-summary .stat-item {
          background-color: #374151 !important;
          border-color: #4a5568 !important;
        }
        body.dark-theme #asset-inventory-container h2,
        body.dark-theme #asset-inventory-container h3 { color: #f0f0f0 !important; }
        body.dark-theme #asset-inventory-container p { color: #cbd5e0 !important; }
        body.dark-theme #asset-inventory-container input,
        body.dark-theme #asset-inventory-container select,
        body.dark-theme #asset-inventory-container textarea {
          background-color: #374151 !important;
          border-color: #4a5568 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme #asset-inventory-container .btn-secondary,
        body.dark-theme #asset-inventory-container .btn-outline {
          background-color: #374151 !important;
          border-color: #4a5568 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme #asset-inventory-container .tips-section,
        body.dark-theme #asset-inventory-container .info-box {
          background-color: #374151 !important;
          border-color: #4a5568 !important;
          color: #cbd5e0 !important;
        }
        body.dark-theme #asset-inventory-container .notification {
          background-color: #2d3748 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme #asset-inventory-container table { color: #e0e0e0 !important; }
        body.dark-theme #asset-inventory-container table th {
          background-color: #374151 !important;
          color: #e0e0e0 !important;
        }
        body.dark-theme #asset-inventory-container table td { border-color: #4a5568 !important; }
        body.dark-theme #asset-inventory-container table tr:nth-child(even) { background-color: #2d3748 !important; }
        body.dark-theme #asset-inventory-container .progress-bar { background-color: #374151 !important; }
      `;
      document.head.appendChild(style);
    }

    // Load scripts - parallel where possible, then sequential for dependencies
    const parallelScripts = [
      '/asset-inventory/scripts/utils.js',
      '/asset-inventory/scripts/data-migration.js',
      '/asset-inventory/scripts/modules/asset-inventory-i18n.js?v=2',
    ];

    const sequentialScripts = [
      '/asset-inventory/scripts/api-sync.js',
      '/asset-inventory/scripts/data-manager.js',
      '/asset-inventory/scripts/modules/asset-inventory.js?v=2',
      '/asset-inventory/scripts/modules/session-manager.js?v=1',
      '/asset-inventory/scripts/app.js?v=2',
    ];

    // Defer exceljs (925KB) - only needed for export, not initial render
    const deferredScripts = [
      '/asset-inventory/scripts/lib/exceljs.min.js',
    ];

    function loadScript(src) {
      return new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = resolve;
        document.body.appendChild(script);
      });
    }

    // Load parallel scripts first, then sequential, then deferred
    Promise.all(parallelScripts.map(loadScript)).then(async () => {
      for (const src of sequentialScripts) {
        await loadScript(src);
      }
      // Initialize module
      setTimeout(() => {
        if (window.DataManager && window.DataManager.init) {
          window.DataManager.init();
        }
        if (typeof window.loadAssetInventory === 'function') {
          window.loadAssetInventory();
        } else if (typeof window.loadAssetInventoryModule === 'function') {
          const contentBody = document.getElementById('content-body');
          if (contentBody) {
            window.loadAssetInventoryModule(contentBody);
          }
        }
      }, 50);
      // Load exceljs in background after UI is ready
      for (const src of deferredScripts) {
        await loadScript(src);
      }
    });
  }, []);

  // Sync theme
  useEffect(() => {
    if (state.isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [state.isDarkTheme]);

  // Sync language changes - re-render asset inventory module
  useEffect(() => {
    if (typeof window.loadAssetInventoryModule === 'function' && window.assetInventoryData) {
      const contentBody = document.getElementById('content-body');
      if (contentBody) {
        window.loadAssetInventoryModule(contentBody);
      }
    }
  }, [i18n.language]);

  return (
    <Box id="asset-inventory-container" sx={{ width: '100%', minHeight: 600 }}>
      <div ref={containerRef} />
    </Box>
  );
};

export default AssetInventory;
