import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { PostHogProvider } from 'posthog-js/react';
import App from './App.tsx';
import './index.css';

// Get Clerk publishable key from environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file.');
}

// PostHog configuration
const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider 
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={posthogOptions}
    >
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </PostHogProvider>
  </StrictMode>
);
