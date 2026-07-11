import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.tsx';
import { PostHogProvider } from './providers/PostHogProvider.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLive = import.meta.env.VITE_SERVICE_MODE === 'live';

if (isLive && !PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file.');
}

const app = <PostHogProvider><App /></PostHogProvider>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isLive ? <ClerkProvider publishableKey={PUBLISHABLE_KEY!} afterSignOutUrl="/">{app}</ClerkProvider> : app}</StrictMode>
);
