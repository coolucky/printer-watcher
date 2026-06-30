import React from 'react';
import { Tabs, Tab } from '@mui/material';
import { Print, Dashboard, Description, Settings, Group, NotificationsActive, Dns, Inventory2, BarChart, ConfirmationNumber } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context';
import { ENABLE_PRINT_ANALYTICS } from '../config/features';

/**
 * TabNavigation Component - 标签导航
 * 管理应用的主要功能标签
 */
const TabNavigation = ({ currentUser, onTabChange }) => {
  const { state } = useAppContext();
  const { tabValue } = state;
  const { t } = useTranslation();

  return (
    <Tabs
      value={tabValue}
      onChange={onTabChange}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{
        mb: 3,
        '& .MuiTabs-indicator': {
          backgroundColor: 'var(--primary-color)',
        },
        '& .MuiTab-root': {
          color: 'var(--text-secondary)',
          minWidth: 'auto',
          padding: '12px 8px',
          fontSize: '0.875rem',
          textTransform: 'none',
          whiteSpace: 'nowrap',
          borderRadius: '6px',
          transition: 'background-color 0.2s, color 0.2s',
          '&:hover': {
            color: 'var(--primary-color)',
            backgroundColor: 'rgba(100, 108, 255, 0.08)',
          },
          '&.Mui-selected': {
            color: 'var(--primary-color)',
            fontWeight: 600,
          },
        },
      }}
    >
      <Tab label={t('tabs.devicesManagement')} icon={<Dns size={20} />} iconPosition="start" />
      <Tab label={t('tabs.statusMonitoring')} icon={<Dashboard size={20} />} iconPosition="start" />
      <Tab
        label={t('tabs.printAnalytics') || 'Print Analytics'}
        icon={<BarChart size={20} />}
        iconPosition="start"
        aria-hidden={!ENABLE_PRINT_ANALYTICS}
        disabled={!ENABLE_PRINT_ANALYTICS}
        sx={!ENABLE_PRINT_ANALYTICS ? { display: 'none !important' } : undefined}
      />
      <Tab label={t('tabs.reportGeneration')} icon={<Description size={20} />} iconPosition="start" />
      <Tab label={t('tabs.systemSettings')} icon={<Settings size={20} />} iconPosition="start" />
      <Tab label={t('tabs.alertSettings')} icon={<NotificationsActive size={20} />} iconPosition="start" />
      <Tab label={t('tabs.userManagement')} icon={<Group size={20} />} iconPosition="start"
        disabled={!(currentUser?.role === 'admin' || currentUser?.role === 'Administrator')}
        sx={!(currentUser?.role === 'admin' || currentUser?.role === 'Administrator') ? { display: 'none !important' } : undefined}
      />
      <Tab label={t('tabs.assetInventory')} icon={<Inventory2 size={20} />} iconPosition="start" />
      <Tab label={t('tabs.jiraTickets')} icon={<ConfirmationNumber size={20} />} iconPosition="start" />
    </Tabs>
  );
};

export default TabNavigation;
