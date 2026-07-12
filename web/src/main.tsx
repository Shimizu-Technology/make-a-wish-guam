import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ServiceCheck } from './ServiceCheck.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ServiceCheck /></StrictMode>
);
