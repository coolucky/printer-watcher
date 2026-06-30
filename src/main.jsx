import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { AppProvider } from './context'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './hooks/useNotification'
import ThemeWrapper from './theme/ThemeWrapper'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <ThemeWrapper>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </ThemeWrapper>
      </AppProvider>
    </AuthProvider>
  </StrictMode>,
)
