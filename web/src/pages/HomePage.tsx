import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  History,
  LayoutDashboard,
  Quote,
  RefreshCw,
  Ticket,
  Trophy
} from 'lucide-react';
import { Button } from '../components/ui';
import { SignedInAdminBar } from '../components/SignedInAdminBar';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [orgSlug, setOrgSlug] = useState('');
  const cleanedSlug = useMemo(
    () => orgSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
    [orgSlug]
  );

  const goToOrg = () => {
    if (!cleanedSlug) return;
    navigate(`/${cleanedSlug}`);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <SignedInAdminBar />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-cyan-100 blur-3xl" />
        </div>

        <section className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <header className="mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Trophy size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-stone-900">Shimizu Technology</p>
                <p className="text-xs text-stone-600">Multi-tenant tournament platform</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 text-sm md:flex">
              <Link
                to="/legacy"
                className="rounded-full border border-stone-300 px-4 py-2 text-stone-700 transition-colors hover:bg-stone-100"
              >
                Legacy View
              </Link>
              {isLoaded && isSignedIn && (
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 font-medium text-white transition-colors hover:bg-stone-700"
                >
                  <LayoutDashboard size={16} />
                  Admin Dashboard
                </Link>
              )}
            </div>
          </header>
          <div className="mb-8 flex flex-wrap items-center gap-2 text-sm md:hidden">
            <Link
              to="/legacy"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-stone-700 transition-colors hover:bg-stone-100"
            >
              Legacy View
            </Link>
            <Link
              to="/admin/login"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-stone-700 transition-colors hover:bg-stone-100"
            >
              Staff Login
            </Link>
            {isLoaded && isSignedIn && (
              <Link
                to="/admin/dashboard"
                className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 font-medium text-white transition-colors hover:bg-stone-700"
              >
                <LayoutDashboard size={14} />
                Admin
              </Link>
            )}
          </div>

          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Organization-first experience
              </p>
              <h1 className="mb-6 text-4xl font-display font-bold tracking-tight text-stone-900 md:text-5xl lg:text-6xl">
                One platform for every tournament host.
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-stone-700">
                This platform replaces manual spreadsheets and disconnected workflows with one secure system for
                registration, check-in, scoring, raffles, sponsor workflows, and operations.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <QuickStat icon={Globe} label="Tenant routing" value="Path-based today" />
                <QuickStat icon={RefreshCw} label="Live sync" value="Shared real-time updates" />
                <QuickStat icon={History} label="Audit logs" value="Track who changed what" />
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-5">
              <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold text-stone-900">
                <Building2 size={20} />
                Open your organization portal
              </h2>
              <p className="mb-4 text-sm text-stone-600">
                Enter your organization slug to go directly to your branded tournament page.
              </p>
              <label htmlFor="org-slug" className="mb-2 block text-sm font-medium text-stone-700">
                Organization slug
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="org-slug"
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToOrg()}
                  placeholder="rotary-guam"
                  className="flex-1 rounded-xl border border-stone-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button onClick={goToOrg} className="inline-flex items-center justify-center px-5">
                  Open
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-stone-500">
                URL preview:{' '}
                <span className="font-medium text-stone-700">
                  events.shimizu-technology.com/{cleanedSlug || 'your-organization'}
                </span>
              </p>

              <div className="mt-5 border-t border-stone-200 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Common examples</p>
                <div className="flex flex-wrap gap-2">
                  {['rotary-guam', 'chamber-guam', 'gngf'].map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setOrgSlug(slug)}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                    >
                      /{slug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-stone-200/80 bg-white/70">
          <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
            <h2 className="mb-3 text-2xl font-display font-semibold tracking-tight text-stone-900">How organizations use this platform</h2>
            <p className="mb-6 max-w-3xl text-sm leading-relaxed text-stone-600">
              Built from real tournament operations in Guam. Teams move from manual coordination to one shared
              platform where updates are immediate and every critical action is visible.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                title="Publish a branded portal"
                description="Each host runs on its own path and controls registration details, branding, and event settings."
              />
              <FeatureCard
                title="Centralize tournament operations"
                description="Replace cross-referenced spreadsheets with one source of truth for admin staff and volunteers."
              />
              <FeatureCard
                title="Seamless check-in flow"
                description="Check-in is fast and consistent on tournament day, so teams can process golfers without bottlenecks."
              />
              <FeatureCard
                icon={History}
                title="Audit log accountability"
                description="Every key admin change is logged so organizations can track who did what, when, and where."
              />
              <FeatureCard
                icon={Ticket}
                title="Raffles and extras in-platform"
                description="Handle raffle board and related event workflows in the same system as registration and scoring."
              />
              <FeatureCard
                icon={CheckCircle2}
                title="Live leaderboard and status"
                description="Players and guests can follow live updates while authorized staff manage entry and operations."
              />
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              Guam International Airport Authority
            </p>
            <h2 className="mb-4 text-2xl font-display font-semibold tracking-tight text-stone-900">
              Digital transformation outcome
            </h2>
            <blockquote className="rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
              <Quote size={18} className="mb-3 text-emerald-700" />
              <p className="text-base leading-relaxed text-stone-700 sm:text-lg">
                "Transitioning to a digital system was a significant milestone for us. The rollout was smooth,
                user-friendly for registrants, and efficient for our team. We immediately saw the benefits of a
                streamlined workflow."
              </p>
              <footer className="mt-4 border-t border-stone-200 pt-4 text-sm text-stone-600">
                Guam International Airport Authority - Golf Tournament Registration System
              </footer>
            </blockquote>
            <p className="mt-4 text-xs text-stone-500">
              Source: Shimizu Technology delivery feedback from airport tournament rollout.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-10 text-sm text-stone-600">
          <div className="flex flex-col gap-4 border-t border-stone-200 pt-6 md:flex-row md:items-center md:justify-between">
            <p>
              Subdomain support (for example <span className="font-medium text-stone-800">rotary.events.shimizu-technology.com</span>)
              is planned as a future enhancement.
            </p>
            <a
              href="https://shimizu-technology.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-stone-700 underline-offset-2 transition-colors hover:text-emerald-700 hover:underline"
            >
              Built by Shimizu Technology
              <ArrowRight size={14} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
};

type QuickStatProps = {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: string;
};

const QuickStat: React.FC<QuickStatProps> = ({ icon: Icon, label, value }) => {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <Icon size={16} className="mb-2 text-emerald-700" />
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-sm font-medium text-stone-900">{value}</p>
    </div>
  );
};

type FeatureCardProps = {
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description: string;
};

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description }) => {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      {Icon && <Icon size={16} className="mb-2 text-emerald-700" />}
      <h3 className="mb-2 font-semibold text-stone-900">{title}</h3>
      <p className="text-sm leading-relaxed text-stone-600">{description}</p>
    </article>
  );
};
