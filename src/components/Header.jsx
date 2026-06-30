import React from 'react';
import { Box, Typography, IconButton, Tooltip, Avatar } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context';
import LanguageSelector from './LanguageSelector';

/**
 * Header Component - 应用顶部导航栏
 * 显示应用标题、时间、许可证信息和用户控制
 */
const Header = ({ formatBeijingTime, onUserProfileClick, onThemeToggle, getUserInitials, getAvatarColor }) => {
  const { state } = useAppContext();
  const { isDarkTheme, licenseDays, currentDateTime, currentUser } = state;
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 2,
        px: 3,
        backgroundColor: 'var(--background-paper)',
        borderRadius: 2,
        boxShadow: 1,
        mb: 3
      }}
    >
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{ color: 'var(--text-primary)', fontWeight: 'bold', margin: 0, fontSize: '1.75rem' }}
        >
          {t('header.title')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {licenseDays !== null && (
          <Typography
            variant="body2"
            sx={{
              color: licenseDays < 30 ? 'var(--error-color)' : licenseDays < 90 ? 'var(--warning-color)' : 'var(--text-secondary)',
              backgroundColor: 'var(--background-alt)',
              padding: '4px 10px',
              borderRadius: '4px',
              border: `1px solid ${licenseDays < 30 ? 'var(--error-color)' : 'var(--divider-color)'}`,
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 500,
              fontSize: '0.9rem'
            }}
          >
            {t('header.license')}&nbsp;<span style={{ color: licenseDays < 30 ? 'var(--error-color)' : licenseDays < 90 ? 'var(--warning-color)' : 'var(--success-color)', fontWeight: 600, fontSize: '1rem' }}>
              {licenseDays}
            </span>&nbsp;{t('header.days')}
          </Typography>
        )}

        <LanguageSelector />

        <IconButton onClick={onThemeToggle} color="inherit" title={t('header.toggleTheme')}>
          {isDarkTheme ? <LightMode size={20} /> : <DarkMode size={20} />}
        </IconButton>

        <Tooltip title="User Profile">
          <IconButton onClick={onUserProfileClick} sx={{ borderRadius: 1 }}>
            <Avatar
              variant="rounded"
              sx={{
                backgroundColor: getAvatarColor(currentUser?.username || ''),
                borderRadius: 1,
                width: 'auto',
                minWidth: 36,
                px: 1,
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              {currentUser?.ntid || getUserInitials(currentUser?.username || '')}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default Header;
