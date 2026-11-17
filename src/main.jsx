import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { ToastProvider } from './components/common/Toast.jsx';
import { ConfirmProvider } from './components/common/Confirm.jsx';
import { registerServiceWorker } from './pwa/register.js';
import './pwa/install.js'; // starts listening for the browser's install prompt right away

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
