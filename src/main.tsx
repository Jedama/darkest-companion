// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { EstateProvider } from './contexts/EstateContext.js'; // Adjust path as needed
import './styles/fonts.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EstateProvider>
      <App />
    </EstateProvider>
  </StrictMode>
);
