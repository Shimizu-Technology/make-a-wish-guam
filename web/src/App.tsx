import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OrganizationProvider } from './components/OrganizationProvider';
import { TournamentProvider } from './contexts';
import { GolferAuthProvider } from './contexts';
import {
  PaymentSuccessPage,
  PaymentCancelPage,
  AdminLoginPage,
  OrgAdminDashboard,
  OrgTournamentAdmin,
  OrgCheckInPage,
  OrgSettingsPage,
  OrgRegistrationPage,
  OrgRegistrationSuccessPage,
  OrgTournamentPage,
  OrganizationLandingPage,
  RaffleBoardPage,
  RaffleManagementPage,
  SponsorManagementPage,
  SponsorPortalPage,
  GolferLoginPage,
  GolferVerifyPage,
  GolferDashboardPage,
  LeaderboardPage,
  ScorecardPage,
  CreateTournamentPage,
} from './pages';
import { PaymentReconciliationPage } from './pages/PaymentReconciliationPage';

// MAW is the only org — hardcoded slug, no tenant routing needed
const MAW_SLUG = 'make-a-wish-guam';

// Wrapper that always provides the MAW org context
function MAWWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider orgSlug={MAW_SLUG}>
      {children}
    </OrganizationProvider>
  );
}

function AdminRouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <TournamentProvider>
        {children}
      </TournamentProvider>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Toaster position="top-right" />
          <Routes>
            {/* === PUBLIC: Make-A-Wish Events Hub === */}
            <Route path="/" element={<MAWWrapper><OrganizationLandingPage /></MAWWrapper>} />

            {/* Sponsor portal */}
            <Route path="/sponsor-portal" element={<MAWWrapper><SponsorPortalPage /></MAWWrapper>} />
            <Route path="/sponsor-portal/login" element={<MAWWrapper><SponsorPortalPage /></MAWWrapper>} />

            {/* === ADMIN ROUTES === */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminRouteWrapper><MAWWrapper><OrgAdminDashboard /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/settings" element={<AdminRouteWrapper><MAWWrapper><OrgSettingsPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/new" element={<AdminRouteWrapper><MAWWrapper><CreateTournamentPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug" element={<AdminRouteWrapper><MAWWrapper><OrgTournamentAdmin /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug/checkin" element={<AdminRouteWrapper><MAWWrapper><OrgCheckInPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug/payments" element={<AdminRouteWrapper><MAWWrapper><PaymentReconciliationPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug/scorecard" element={<AdminRouteWrapper><MAWWrapper><ScorecardPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug/raffle" element={<AdminRouteWrapper><MAWWrapper><RaffleManagementPage /></MAWWrapper></AdminRouteWrapper>} />
            <Route path="/admin/tournaments/:tournamentSlug/sponsors" element={<AdminRouteWrapper><MAWWrapper><SponsorManagementPage /></MAWWrapper></AdminRouteWrapper>} />

            {/* Payment callbacks */}
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/cancel" element={<PaymentCancelPage />} />

            {/* Golfer scoring */}
            <Route path="/score" element={<GolferAuthProvider><GolferLoginPage /></GolferAuthProvider>} />
            <Route path="/score/verify" element={<GolferAuthProvider><GolferVerifyPage /></GolferAuthProvider>} />
            <Route path="/golfer/dashboard" element={<GolferAuthProvider><GolferDashboardPage /></GolferAuthProvider>} />
            <Route path="/golfer/scorecard" element={<GolferAuthProvider><ScorecardPage /></GolferAuthProvider>} />

            {/* Tournament pages — slug only, no org prefix */}
            <Route path="/:tournamentSlug" element={<MAWWrapper><OrgTournamentPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/register" element={<MAWWrapper><OrgRegistrationPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/success" element={<MAWWrapper><OrgRegistrationSuccessPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/leaderboard" element={<MAWWrapper><LeaderboardPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/raffle" element={<MAWWrapper><RaffleBoardPage /></MAWWrapper>} />

            {/* Catch-all */}
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
