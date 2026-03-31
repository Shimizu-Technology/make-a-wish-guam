import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { Trophy, LayoutDashboard, Users, ClipboardCheck, Settings, Home, Menu, X, BarChart3, Calendar, ChevronDown } from 'lucide-react';
import { useTournament } from '../contexts';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tournamentDropdownOpen, setTournamentDropdownOpen] = useState(false);
  
  const { tournaments, currentTournament, setCurrentTournament, isLoading } = useTournament();

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/groups', icon: Users, label: 'Groups' },
    { path: '/admin/checkin', icon: ClipboardCheck, label: 'Check-In' },
    { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
    { path: '/admin/tournaments', icon: Calendar, label: 'Tournaments' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleTournamentSelect = (tournament: typeof currentTournament) => {
    if (tournament) {
      setCurrentTournament(tournament);
    }
    setTournamentDropdownOpen(false);
  };

  const activeTournaments = tournaments.filter(t => t.status !== 'archived');
  const archivedTournaments = tournaments.filter(t => t.status === 'archived');

  return (
    <div className="min-h-screen bg-gray-100 pb-20 lg:pb-0">
      {/* Top Navigation */}
      <nav className="bg-brand-800 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 lg:h-16">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity"
            >
              <Trophy size={28} className="lg:w-8 lg:h-8" />
              <div className="text-left">
                <h1 className="font-bold text-base lg:text-lg">Tournament Admin</h1>
                <p className="text-[10px] lg:text-xs text-brand-200 hidden sm:block">
                  {currentTournament?.name?.replace(' Golf Tournament', '') || 'Loading...'}
                </p>
              </div>
            </button>
            
            {/* Tournament Selector (Desktop) */}
            <div className="hidden lg:block relative">
              <button
                onClick={() => setTournamentDropdownOpen(!tournamentDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-700 hover:bg-brand-700 rounded-lg text-sm transition-colors"
              >
                <Calendar size={16} />
                <span className="max-w-[200px] truncate">
                  {isLoading ? 'Loading...' : currentTournament?.short_name || 'Select Tournament'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${tournamentDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {tournamentDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setTournamentDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
                    {activeTournaments.length > 0 && (
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Active Tournaments</p>
                        {activeTournaments.map(tournament => (
                          <button
                            key={tournament.id}
                            onClick={() => handleTournamentSelect(tournament)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              currentTournament?.id === tournament.id
                                ? 'bg-brand-100 text-brand-800'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="font-medium">{tournament.short_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                tournament.status === 'open' ? 'bg-green-500' :
                                tournament.status === 'draft' ? 'bg-yellow-500' :
                                tournament.status === 'closed' ? 'bg-red-500' : 'bg-gray-400'
                              }`} />
                              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                              {tournament.status === 'open' && ` • ${tournament.confirmed_count}/${tournament.max_capacity}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {archivedTournaments.length > 0 && (
                      <div className="p-2 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Archived</p>
                        {archivedTournaments.slice(0, 3).map(tournament => (
                          <button
                            key={tournament.id}
                            onClick={() => handleTournamentSelect(tournament)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              currentTournament?.id === tournament.id
                                ? 'bg-brand-100 text-brand-800'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <div className="font-medium">{tournament.short_name}</div>
                            <div className="text-xs text-gray-400">Archived</div>
                          </button>
                        ))}
                        {archivedTournaments.length > 3 && (
                          <button
                            onClick={() => {
                              setTournamentDropdownOpen(false);
                              navigate('/admin/tournaments');
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-brand-600 hover:text-brand-800"
                          >
                            View all {archivedTournaments.length} archived →
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setTournamentDropdownOpen(false);
                          navigate('/admin/tournaments');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-brand-600 hover:text-brand-800 font-medium"
                      >
                        Manage Tournaments →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 lg:gap-4">
              <button
                onClick={() => navigate('/')}
                className="hidden lg:flex items-center gap-1 text-sm text-brand-200 hover:text-white transition-colors"
              >
                <Home size={16} />
                Home
              </button>
              {user && (
                <span className="hidden lg:inline text-sm text-brand-200 max-w-[150px] truncate">
                  {user.firstName || user.emailAddresses[0]?.emailAddress}
                </span>
              )}
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 lg:w-9 lg:h-9",
                  },
                }}
              />
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-brand-700 transition-colors"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-brand-700 border-t border-brand-600 animate-fade-in">
            <div className="container mx-auto px-4 py-3 space-y-1">
              {/* Tournament selector for mobile */}
              <div className="mb-3 px-2">
                <p className="text-xs text-brand-300 mb-2">Current Tournament:</p>
                <select
                  value={currentTournament?.id || ''}
                  onChange={(e) => {
                    const selected = tournaments.find(t => t.id === parseInt(e.target.value));
                    if (selected) handleTournamentSelect(selected);
                  }}
                  className="w-full bg-brand-800 text-white border border-brand-600 rounded-lg px-3 py-2 text-sm"
                >
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.short_name} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
              
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-800 text-white'
                        : 'text-brand-100 hover:bg-brand-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => handleNavigate('/')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-brand-100 hover:bg-brand-700 transition-colors"
              >
                <Home size={20} />
                <span className="font-medium">Home</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="container mx-auto px-3 lg:px-4 py-4 lg:py-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Desktop Sidebar - Hidden on mobile */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md p-4 space-y-2 sticky top-24">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-800 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {menuItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-colors ${
                  isActive
                    ? 'text-brand-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
