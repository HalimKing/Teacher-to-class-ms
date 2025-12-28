import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light', // This should be dynamic based on your dark mode state
    primary: {
      main: '#4F46E5', // Indigo 600
    },
    secondary: {
      main: '#7C3AED', // Purple 600
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            '& fieldset': {
              borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
            },
            '&:hover fieldset': {
              borderColor: theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#4F46E5',
            },
          },
          '& .MuiInputLabel-root': {
            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
          },
          '& .MuiOutlinedInput-input': {
            color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
          },
        }),
      },
    },
  },
});