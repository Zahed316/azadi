import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { init } from '@tma.js/sdk';

try {
  init();
} catch (e) {
  console.error('Failed to initialize Telegram SDK', e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
