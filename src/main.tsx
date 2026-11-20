import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { MoneyProvider } from './lib/money';

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
