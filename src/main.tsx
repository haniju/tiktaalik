import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Side-effect : attache le listener beforeinstallprompt avant le rendu React
import './utils/pwaInstall';

if (__IS_BETA__) document.title = 'Tiktaalik BETA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
