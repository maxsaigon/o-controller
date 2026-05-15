import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesktopShell } from './app-shell/DesktopShell';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopShell />
  </React.StrictMode>,
);
