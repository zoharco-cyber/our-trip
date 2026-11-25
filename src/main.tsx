import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { MoneyProvider } from './lib/money';
import { registerSW } from 'virtual:pwa-register';
import { installErrorHandlers } from './lib/health';

installErrorHandlers();

// גרסה חדשה של האתר מתקינה את עצמה לבד: בודקים כשחוזרים לאפליקציה ופעם בשעה
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <MoneyProvider>
          <App />
        </MoneyProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
