import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  HomePage,
  LandingPage,
  PaymentSuccessPage,
  PaymentCancelPage,
  AdminLoginPage,
  AdminDashboard,
  GroupManagementPage,
  CheckInPage,
  AdminSettingsPage,
  ReportsPage,
  TournamentManagementPage,
} from './pages';
import { ProtectedRoute } from './components/ProtectedRoute';
import { TournamentProvider } from './contexts';
import { OrganizationProvider } from './components/OrganizationProvider';
import { 
  OrganizationLandingPage, 
  OrgRegistrationPage,
  OrgTournamentPage,
  OrgRegistrationSuccessPage,
} from './pages';
import { OrgAdminDashboard } from './pages/OrgAdminDashboard';
import { OrgTournamentAdmin } from './pages/OrgTournamentAdmin';
import { OrgCheckInPage } from './pages/OrgCheckInPage';
import { CreateTournamentPage } from './pages/CreateTournamentPage';
import { LeaderboardPage, ScorecardPage, RaffleBoardPage, RaffleManagementPage, SponsorManagementPage, GolferLoginPage, GolferVerifyPage, GolferDashboardPage } from './pages';
// Super admin pages removed (single-org app)
import { OrgSettingsPage } from './pages/OrgSettingsPage';
import { GolferAuthProvider } from './contexts';

// Wrapper component for admin routes with tournament context
function AdminRouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <TournamentProvider>
        {children}
      </TournamentProvider>
    </ProtectedRoute>
  );
}

// Wrapper for organization-scoped public routes
function OrgRouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
        <Toaster position="top-right" />
        <Routes>
        {/* ===========================================
            ORGANIZATION-SCOPED PUBLIC ROUTES (Multi-tenant)
            NOTE: /:orgSlug is a catch-all - keep it AFTER specific routes!
            =========================================== */}
        
        {/* Organization landing page - shows all tournaments */}
        <Route
          path="/:orgSlug"
          element={
            <OrgRouteWrapper>
              <OrganizationLandingPage />
            </OrgRouteWrapper>
          }
        />

        {/* Tournament-specific pages */}
        <Route
          path="/:orgSlug/tournaments/:tournamentSlug"
          element={
            <OrgRouteWrapper>
              <OrgTournamentPage />
            </OrgRouteWrapper>
          }
        />
        <Route
          path="/:orgSlug/tournaments/:tournamentSlug/register"
          element={
            <OrgRouteWrapper>
              <OrgRegistrationPage />
            </OrgRouteWrapper>
          }
        />
        <Route
          path="/:orgSlug/tournaments/:tournamentSlug/success"
          element={
            <OrgRouteWrapper>
              <OrgRegistrationSuccessPage />
            </OrgRouteWrapper>
          }
        />

        {/* Live Leaderboard (Public) */}
        <Route
          path="/:orgSlug/tournaments/:tournamentSlug/leaderboard"
          element={
            <OrgRouteWrapper>
              <LeaderboardPage />
            </OrgRouteWrapper>
          }
        />

        {/* Raffle Board (Public) */}
        <Route
          path="/:orgSlug/tournaments/:tournamentSlug/raffle"
          element={
            <OrgRouteWrapper>
              <RaffleBoardPage />
            </OrgRouteWrapper>
          }
        />

        {/* ===========================================
            ORG-SCOPED ADMIN ROUTES (Multi-tenant)
            =========================================== */}
        
        {/* Organization Admin Dashboard */}
        <Route
          path="/:orgSlug/admin"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <OrgAdminDashboard />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Organization Settings */}
        <Route
          path="/:orgSlug/admin/settings"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <OrgSettingsPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Create New Tournament */}
        <Route
          path="/:orgSlug/admin/tournaments/new"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <CreateTournamentPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Tournament Admin Dashboard */}
        <Route
          path="/:orgSlug/admin/tournaments/:tournamentSlug"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <OrgTournamentAdmin />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Tournament Check-In */}
        <Route
          path="/:orgSlug/admin/tournaments/:tournamentSlug/checkin"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <OrgCheckInPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Scorecard Entry (Admin) */}
        <Route
          path="/:orgSlug/admin/tournaments/:tournamentSlug/scorecard"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <ScorecardPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Raffle Management (Admin) */}
        <Route
          path="/:orgSlug/admin/tournaments/:tournamentSlug/raffle"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <RaffleManagementPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* Sponsor Management (Admin) */}
        <Route
          path="/:orgSlug/admin/tournaments/:tournamentSlug/sponsors"
          element={
            <ProtectedRoute>
              <OrganizationProvider>
                <SponsorManagementPage />
              </OrganizationProvider>
            </ProtectedRoute>
          }
        />

        {/* ===========================================
            GOLFER SCORING ACCESS ROUTES (Public)
            =========================================== */}
        <Route
          path="/score"
          element={
            <GolferAuthProvider>
              <GolferLoginPage />
            </GolferAuthProvider>
          }
        />
        <Route
          path="/score/verify"
          element={
            <GolferAuthProvider>
              <GolferVerifyPage />
            </GolferAuthProvider>
          }
        />
        <Route
          path="/golfer/dashboard"
          element={
            <GolferAuthProvider>
              <GolferDashboardPage />
            </GolferAuthProvider>
          }
        />
        
        {/* Golfer Scorecard Entry (uses golfer auth) */}
        <Route
          path="/golfer/scorecard"
          element={
            <GolferAuthProvider>
              <ScorecardPage />
            </GolferAuthProvider>
          }
        />

        {/* ===========================================
            LEGACY PUBLIC ROUTES (Backwards compatibility)
            =========================================== */}
        <Route path="/" element={<HomePage />} />
        <Route path="/legacy" element={<LandingPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/cancel" element={<PaymentCancelPage />} />

        {/* ===========================================
            ADMIN ROUTES
            =========================================== */}
        
        {/* Admin Login (public) */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected Admin Routes with Tournament Context */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminRouteWrapper>
              <AdminDashboard />
            </AdminRouteWrapper>
          }
        />
        <Route
          path="/admin/groups"
          element={
            <AdminRouteWrapper>
              <GroupManagementPage />
            </AdminRouteWrapper>
          }
        />
        <Route
          path="/admin/checkin"
          element={
            <AdminRouteWrapper>
              <CheckInPage />
            </AdminRouteWrapper>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminRouteWrapper>
              <AdminSettingsPage />
            </AdminRouteWrapper>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminRouteWrapper>
              <ReportsPage />
            </AdminRouteWrapper>
          }
        />
        <Route
          path="/admin/tournaments"
          element={
            <AdminRouteWrapper>
              <TournamentManagementPage />
            </AdminRouteWrapper>
          }
        />

        {/* Catch-all redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        {/* Shimizu Technology attribution */}
        <footer className="py-4 text-center border-t border-gray-100 bg-white mt-auto">
          <a
            href="https://shimizu-technology.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            Built by <span className="font-medium">Shimizu Technology</span>
          </a>
        </footer>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
