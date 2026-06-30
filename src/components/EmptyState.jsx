import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';

/**
 * Empty state placeholder with illustration, description, and optional CTA.
 */
export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  const Icon = icon || PrintIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          mb: 3,
        }}
      >
        <Icon sx={{ fontSize: 40, color: 'text.secondary' }} />
      </Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: actionLabel ? 3 : 0 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
