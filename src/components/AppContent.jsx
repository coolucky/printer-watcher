import React, { Suspense, lazy } from 'react';
import { Paper, Box, CircularProgress } from '@mui/material';
import { useAppContext } from '../context';
import { ENABLE_PRINT_ANALYTICS } from '../config/features';
import PrinterList from './PrinterList';
import PrintServerConfig from './PrintServerConfig';
import StatusDashboard from './StatusDashboard';
import PrintServerMonitoring from './PrintServerMonitoring';

// Lazy-load less frequently used tabs
const PrintAnalytics = lazy(() => import('./PrintAnalytics'));
const ReportForm = lazy(() => import('./ReportForm'));
const SettingsPanel = lazy(() => import('./SettingsPanel'));
const UserManagement = lazy(() => import('./UserManagement'));
const AlertSettings = lazy(() => import('./AlertSettings'));
const AssetInventory = lazy(() => import('./AssetInventory'));
const JiraTickets = lazy(() => import('./JiraTickets'));

const LazyFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
    <CircularProgress size={32} />
  </Box>
);

/**
 * AppContent Component - 应用内容区域
 * 根据选中的标签显示相应的内容
 */
const AppContent = ({
  onAddPrinter,
  onUpdatePrinter,
  onDeletePrinter,
  onReorderPrinters,
  onGenerateReport,
  onUpdateSettings,
  onRefreshStatus,
  printers,
  printerStatuses,
  currentUser,
}) => {
  const { state } = useAppContext();
  const { tabValue } = state;

  return (
    <>
      {/* Tab 0: Devices Management - keep mounted to preserve PrintServerConfig data */}
      <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)', display: tabValue === 0 ? 'block' : 'none' }}>
        <PrinterList
          printers={printers}
          onAddPrinter={onAddPrinter}
          onUpdatePrinter={onUpdatePrinter}
          onDeletePrinter={onDeletePrinter}
          onReorderPrinters={onReorderPrinters}
          currentUser={currentUser}
        />
        <PrintServerConfig />
      </Paper>

      {/* Tab 1: Status Monitoring - keep mounted to preserve monitoring data */}
      <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)', boxSizing: 'border-box', display: tabValue === 1 ? 'block' : 'none' }}>
        <StatusDashboard
          printerStatuses={printerStatuses}
          onRefresh={onRefreshStatus}
          licenseDays={state.licenseDays}
        />
        <PrintServerMonitoring />
      </Paper>

      {/* Tab 2: Print Analytics */}
      {ENABLE_PRINT_ANALYTICS && tabValue === 2 && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <PrintAnalytics />
          </Suspense>
        </Paper>
      )}

      {/* Tab 3: Report Generation - keep mounted to preserve schedule timer */}
      <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)', display: tabValue === 3 ? 'block' : 'none' }}>
        <Suspense fallback={<LazyFallback />}>
          <ReportForm
            printers={printers}
            printerStatuses={printerStatuses}
            onGenerateReport={onGenerateReport}
            licenseDays={state.licenseDays}
            currentUser={currentUser}
          />
        </Suspense>
      </Paper>

      {/* Tab 4: System Settings */}
      {tabValue === 4 && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <SettingsPanel onUpdateSettings={onUpdateSettings} currentUser={currentUser} />
          </Suspense>
        </Paper>
      )}

      {/* Tab 5: Alert Settings */}
      {tabValue === 5 && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <AlertSettings currentUser={currentUser} />
          </Suspense>
        </Paper>
      )}

      {/* Tab 6: User Management (admin only) */}
      {tabValue === 6 && (currentUser?.role === 'admin' || currentUser?.role === 'Administrator') && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <UserManagement />
          </Suspense>
        </Paper>
      )}

      {/* Tab 7: Asset Inventory */}
      {tabValue === 7 && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <AssetInventory />
          </Suspense>
        </Paper>
      )}

      {/* Tab 8: Jira Tickets */}
      {tabValue === 8 && (
        <Paper sx={{ p: 3, pt: 1.5, backgroundColor: 'var(--background-paper)' }}>
          <Suspense fallback={<LazyFallback />}>
            <JiraTickets />
          </Suspense>
        </Paper>
      )}
    </>
  );
};

export default AppContent;
