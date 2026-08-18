import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesktopShell } from './app-shell/DesktopShell';
import { initializeThemePreference } from './ui/theme';
import './styles/global.css';
import './styles/flat-theme.css';

initializeThemePreference();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopShell />
  </React.StrictMode>,
);
