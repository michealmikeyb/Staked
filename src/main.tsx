import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { registerBackends } from './lib/api/backends';

registerBackends();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
