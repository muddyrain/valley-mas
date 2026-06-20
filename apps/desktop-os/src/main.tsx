import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/global.css';

const appRoot = document.getElementById('app');

if (!appRoot) {
  throw new Error('Desktop OS mount node #app is missing.');
}

ReactDOM.createRoot(appRoot).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
