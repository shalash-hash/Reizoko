import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../../../packages/ui/src/styles/global.css';
import '@reizoko/platform-instagram';
import '@reizoko/platform-telegram';
import '@reizoko/platform-vk';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
