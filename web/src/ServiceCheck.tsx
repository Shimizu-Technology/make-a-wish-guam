import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { useBackendAvailability } from './hooks/useBackendAvailability';
import { OffseasonPage } from './pages/OffseasonPage';
import { PostHogProvider } from './providers/PostHogProvider';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const HEALTH_URL = `${API_BASE_URL}/health`;

export function ServiceCheck() {
  const { status, retry } = useBackendAvailability(HEALTH_URL);

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-blue-50 px-6 text-center" role="status">
        <div>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#0057B8]" />
          <p className="mt-4 font-semibold text-[#0057B8]">Checking event services…</p>
        </div>
      </main>
    );
  }

  if (status === 'unavailable') return <OffseasonPage onRetry={retry} />;
  if (!PUBLISHABLE_KEY) {
    throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file.');
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <PostHogProvider><App /></PostHogProvider>
    </ClerkProvider>
  );
}
