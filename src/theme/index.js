import { createTheme } from '@mui/material/styles';
import { palette, typography, radius, shadows, transitions } from './tokens';

/**
 * Build MUI theme from design tokens.
 * @param {'light'|'dark'} mode
 */
export function buildTheme(mode = 'light') {
  const p = palette[mode];

  return createTheme({
    palette: {
      mode,
      primary: { main: p.primary.main, light: p.primary.light },
      background: { default: p.background.default, paper: p.background.paper },
      text: { primary: p.text.primary, secondary: p.text.secondary },
      success: { main: p.success.main, light: p.success.light },
      warning: { main: p.warning.main, light: p.warning.light },
      error: { main: p.error.main, light: p.error.light },
      info: { main: p.info.main, light: p.info.light },
      divider: p.border,
    },
    typography: {
      fontFamily: typography.fontFamily,
      h6: { fontWeight: 500 },
    },
    shape: {
      borderRadius: radius.md,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: `background-color ${transitions.normal}, box-shadow ${transitions.normal}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: shadows.card,
            transition: `transform ${transitions.fast}, box-shadow ${transitions.normal}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: shadows.cardHover,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: radius.sm + 2,
            fontWeight: 500,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: radius.lg,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
          },
        },
      },
    },
  });
}
