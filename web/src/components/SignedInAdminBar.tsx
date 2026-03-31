import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, UserButton } from '@clerk/clerk-react';
import { LayoutDashboard } from 'lucide-react';
import { resolveBestDashboardPath } from '../utils/dashboardRouting';

interface SignedInAdminBarProps {
  dashboardPath?: string;
}

export const SignedInAdminBar: React.FC<SignedInAdminBarProps> = ({ dashboardPath }) => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();

  if (!isLoaded || !isSignedIn) return null;

  const displayName = user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User';

  const goToBestDashboard = async () => {
    const path = await resolveBestDashboardPath(getToken, dashboardPath);
    navigate(path);
  };

  return (
    <div className="relative z-20 bg-[#1e3a5f] text-white py-2 px-3 md:px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutDashboard size={16} className="flex-shrink-0" />
          <span className="text-xs md:text-sm truncate">
            Signed in as <strong className="font-semibold">{displayName}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <button
            onClick={goToBestDashboard}
            className="text-xs md:text-sm hover:underline whitespace-nowrap"
          >
            Go to Dashboard →
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  );
};
