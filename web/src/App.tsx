import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { AdminOnlyRoute } from './components/AdminRouteGuard';
import { OrganizationProvider } from './components/OrganizationProvider';
import { TournamentProvider, AdminProvider } from './contexts';
import { GolferAuthProvider } from './contexts';
import {
  AdminLoginPage,
  CreateTournamentPage,
  EventsManagementPage,
  GolferDashboardPage,
  GolferLoginPage,
  GolferVerifyPage,
  LeaderboardPage,
  OrgAdminDashboard,
  OrgCheckInPage,
  OrgRegistrationPage,
  OrgRegistrationSuccessPage,
  OrgSettingsPage,
  OrgTournamentAdmin,
  OrgTournamentPage,
  OrganizationLandingPage,
  PaymentCancelPage,
  PaymentSuccessPage,
  RaffleBoardPage,
  RaffleManagementPage,
  ScorecardPage,
  GroupManagementPage,
  SponsorManagementPage,
  SponsorPortalPage,
  SponsorsOverviewPage,
  ReportsPage,
} from './pages';
import { PaymentReconciliationPage } from './pages/PaymentReconciliationPage';

const MAW_SLUG = 'make-a-wish-guam';

function MAWWrapper({ children }: { children: React.ReactNode }) {
  return <OrganizationProvider orgSlug={MAW_SLUG}>{children}</OrganizationProvider>;
}

function AdminShellPage({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <ProtectedRoute>
        <TournamentProvider>
          <MAWWrapper>
            <AdminLayout>{children}</AdminLayout>
          </MAWWrapper>
        </TournamentProvider>
      </ProtectedRoute>
    </AdminProvider>
  );
}

function LegacyTournamentRedirect({ suffix = '' }: { suffix?: string }) {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  return <Navigate to={tournamentSlug ? `/admin/events/${tournamentSlug}${suffix}` : '/admin/events'} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<MAWWrapper><OrganizationLandingPage /></MAWWrapper>} />

            <Route path="/sponsor-portal" element={<MAWWrapper><SponsorPortalPage /></MAWWrapper>} />
            <Route path="/sponsor-portal/login" element={<MAWWrapper><SponsorPortalPage /></MAWWrapper>} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminShellPage><OrgAdminDashboard /></AdminShellPage>} />
            <Route path="/admin/events" element={<AdminShellPage><AdminOnlyRoute><EventsManagementPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/new" element={<AdminShellPage><AdminOnlyRoute><CreateTournamentPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug" element={<AdminShellPage><AdminOnlyRoute><OrgTournamentAdmin /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/registrations" element={<AdminShellPage><AdminOnlyRoute><OrgTournamentAdmin /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/payments" element={<AdminShellPage><AdminOnlyRoute><PaymentReconciliationPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/checkin" element={<AdminShellPage><OrgCheckInPage /></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/groups" element={<AdminShellPage><AdminOnlyRoute><GroupManagementPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/raffle" element={<AdminShellPage><RaffleManagementPage /></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/sponsors" element={<AdminShellPage><AdminOnlyRoute><SponsorManagementPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/settings" element={<AdminShellPage><AdminOnlyRoute><OrgSettingsPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/events/:tournamentSlug/reports" element={<AdminShellPage><AdminOnlyRoute><ReportsPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/sponsors" element={<AdminShellPage><AdminOnlyRoute><SponsorsOverviewPage /></AdminOnlyRoute></AdminShellPage>} />
            <Route path="/admin/settings" element={<AdminShellPage><AdminOnlyRoute><OrgSettingsPage /></AdminOnlyRoute></AdminShellPage>} />

            <Route path="/admin/tournaments/new" element={<Navigate to="/admin/events/new" replace />} />
            <Route path="/admin/tournaments/:tournamentSlug" element={<LegacyTournamentRedirect />} />
            <Route path="/admin/tournaments/:tournamentSlug/checkin" element={<LegacyTournamentRedirect suffix="/checkin" />} />
            <Route path="/admin/tournaments/:tournamentSlug/payments" element={<LegacyTournamentRedirect suffix="/payments" />} />
            <Route path="/admin/tournaments/:tournamentSlug/scorecard" element={<LegacyTournamentRedirect suffix="/groups" />} />
            <Route path="/admin/tournaments/:tournamentSlug/raffle" element={<LegacyTournamentRedirect suffix="/raffle" />} />
            <Route path="/admin/tournaments/:tournamentSlug/sponsors" element={<LegacyTournamentRedirect suffix="/sponsors" />} />

            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/cancel" element={<PaymentCancelPage />} />

            <Route path="/score" element={<GolferAuthProvider><GolferLoginPage /></GolferAuthProvider>} />
            <Route path="/score/verify" element={<GolferAuthProvider><GolferVerifyPage /></GolferAuthProvider>} />
            <Route path="/golfer/dashboard" element={<GolferAuthProvider><GolferDashboardPage /></GolferAuthProvider>} />
            <Route path="/golfer/scorecard" element={<GolferAuthProvider><ScorecardPage /></GolferAuthProvider>} />

            <Route path="/:tournamentSlug" element={<MAWWrapper><OrgTournamentPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/register" element={<MAWWrapper><OrgRegistrationPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/success" element={<MAWWrapper><OrgRegistrationSuccessPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/leaderboard" element={<MAWWrapper><LeaderboardPage /></MAWWrapper>} />
            <Route path="/:tournamentSlug/raffle" element={<MAWWrapper><RaffleBoardPage /></MAWWrapper>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
