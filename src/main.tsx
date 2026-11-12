import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LangProvider } from './lib/i18n.tsx';
import './index.css';
import './gx.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LangProvider>
        <App />
      </LangProvider>
    </React.StrictMode>
  );
}
