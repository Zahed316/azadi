import React from 'react';
import ReactDOM from 'react-dom/client';

// Font imports — self-hosted, no CDN dependency
// Vazirmatn: Persian body/UI — arabic subset only (OFL, via fontsource)
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-500.css';
import '@fontsource/vazirmatn/arabic-700.css';
// Fraunces: Latin wordmarks (OFL, via fontsource)
import '@fontsource/fraunces/latin-600.css';

import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
