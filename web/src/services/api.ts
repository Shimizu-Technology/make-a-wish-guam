// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  banner_url?: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  subscription_status?: string;
  tournament_count?: number;
  admin_count?: number;
  created_at?: string;
  updated_at?: string;
}

// Sponsor types
export interface Sponsor {
  id: number;
  name: string;
  tier: 'title' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'hole';
  tier_display: string;
  logo_url?: string;
  website_url?: string;
  description?: string;
  course_key?: string | null;
  course_name?: string | null;
  hole_number?: number;
  display_label?: string;
  major: boolean;
}

export interface CourseConfig {
  key: string;
  name: string;
  hole_count: number;
}

export interface SponsorTier {
  key: string;
  label: string;
  sort_order: number;
}

// Types for API responses
export interface Tournament {
  id: number;
  name: string;
  slug: string;
  year: number;
  edition: string | null;
  event_type: 'golf_tournament' | 'gala';
  status: 'draft' | 'open' | 'closed' | 'in_progress' | 'completed' | 'archived';
  event_date: string | null;
  registration_time: string | null;
  start_time: string | null;
  location_name: string | null;
  location_address: string | null;
  max_capacity: number;
  reserved_slots: number;
  entry_fee: number;
  entry_fee_dollars: number;
  organization_id?: string;
  organization_slug?: string;
  format_name: string | null;
  fee_includes: string | null;
  tournament_info?: string | null;
  checks_payable_to: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email?: string | null;
  registration_open: boolean;
  can_register: boolean;
  confirmed_count: number;
  public_confirmed_count: number;
  sponsor_confirmed_count: number;
  sponsor_reserved_teams: number;
  waitlist_count: number;
  capacity_remaining: number;
  at_capacity: boolean;
  public_capacity: number;
  public_capacity_remaining: number;
  public_at_capacity: boolean;
  checked_in_count: number;
  paid_count: number;
  pending_payment_count: number;
  revenue?: number;
  display_name: string;
  short_name: string;
  created_at: string;
  updated_at: string;
  
  // Tournament configuration (Phase 2)
  tournament_format?: 'scramble' | 'stroke' | 'stableford' | 'best_ball' | 'match' | 'captain_choice' | 'custom';
  scoring_type?: 'gross' | 'net' | 'both' | 'stableford';
  team_size?: number;
  teams_per_start_position?: number;
  start_positions_per_hole?: number;
  players_per_start_position?: number;
  teams_per_hole?: number;
  players_per_hole?: number;
  allow_partial_teams?: boolean;
  handicap_required?: boolean;
  handicap_max?: number;
  
  // Flights
  use_flights?: boolean;
  flights_config?: Record<string, unknown>;
  
  // Pricing
  early_bird_fee?: number;
  early_bird_fee_dollars?: number;
  early_bird_deadline?: string;
  early_bird_active?: boolean;
  current_fee?: number;
  current_fee_dollars?: number;
  
  // Registration
  registration_deadline?: string;
  waitlist_enabled?: boolean;
  waitlist_max?: number;
  
  // Payment
  payment_instructions?: string;
  allow_cash?: boolean;
  allow_check?: boolean;
  allow_card?: boolean;
  banner_url_override?: string | null;
  use_org_branding?: boolean;
  
  // Schedule
  check_in_time?: string;
  event_schedule?: string | null;
  shotgun_start?: boolean;
  tee_times_enabled?: boolean;
  tee_time_interval_minutes?: number;
  
  // Sponsors (public display)
  sponsors?: Sponsor[];

  // SwipeSimple / walk-in settings
  swipe_simple_url?: string;
  walkin_swipe_simple_url?: string;
  entry_fee_display?: string;
  walkin_fee?: number;
  walkin_registration_open?: boolean;

  // Raffle settings
  raffle_enabled?: boolean;
  raffle_description?: string;
  raffle_draw_time?: string;
  raffle_auto_draw?: boolean;
  sponsor_edit_deadline?: string | null;
  raffle_ticket_price_cents?: number;
  raffle_include_with_registration?: boolean;
  raffle_bundles?: { quantity: number; price_cents: number; label: string }[];
  course_configs?: CourseConfig[];
  sponsor_tiers?: SponsorTier[];

  // Legacy compatibility fields (optional)
  employee_entry_fee?: number;
  employee_entry_fee_dollars?: number;
  employee_numbers_count?: number;
  hole_pars?: Record<string, number>;
  registration_count?: number;
}

export interface Golfer {
  id: number;
  tournament_id: number;
  name: string;
  last_name: string | null;
  company: string | null;
  address: string | null;
  phone: string;
  mobile: string | null;
  email: string;
  payment_type: 'stripe' | 'pay_on_day' | 'swipe_simple' | 'walk_in' | 'sponsor';
  payment_status: 'paid' | 'unpaid' | 'pending' | 'refunded';
  waiver_accepted_at: string | null;
  waiver_signed: boolean;
  checked_in_at: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled' | 'pending';
  group_id: number | null;
  starting_course_key: string | null;
  starting_course_name: string | null;
  hole_number: number | null;
  position: number | null;
  notes: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  payment_notes: string | null;
  created_at: string;
  updated_at: string;
  group_position_label: string | null;
  starting_position_label: string | null;
  hole_position_label: string | null;
  starting_hole_description?: string | null;
  checked_in: boolean;
  group?: Group | null;
  // Refund/cancel fields
  stripe_card_brand: string | null;
  stripe_card_last4: string | null;
  payment_amount_cents: number | null;
  stripe_refund_id: string | null;
  refund_amount_cents: number | null;
  refund_reason: string | null;
  refunded_at: string | null;
  refunded_by_name: string | null;
  can_refund: boolean;
  can_cancel: boolean;
  cancelled: boolean;
  refunded: boolean;
  formatted_payment_timestamp: string | null;
  // Payment timing fields
  paid_at: string | null;
  payment_timing: 'day_of' | 'pre_paid' | null;
  payment_channel: 'stripe_online' | 'credit_venue' | 'cash' | 'check' | null;
  // Employee fields
  is_employee: boolean;
  employee_number: string | null;
  // Payment link
  payment_token: string | null;
  // Sponsor fields
  sponsor_id: number | null;
  sponsor_name: string | null;
  sponsor_display_name: string | null;
  // Team fields
  partner_name: string | null;
  partner_email: string | null;
  partner_phone: string | null;
  team_name?: string | null;
  team_category: string | null;
  registration_source: 'admin' | 'public' | null;
  // Verification fields
  payment_verified_at: string | null;
  payment_verified_by_name: string | null;
  checked_in_by_name: string | null;
}

export interface PaymentReportSummary {
  registration_revenue_cents: number;
  raffle_revenue_cents: number;
  total_revenue_cents: number;
  registration_paid_count: number;
  registration_pending_count: number;
  sponsored_registration_count: number;
  raffle_paid_ticket_count: number;
  raffle_purchased_ticket_count: number;
  raffle_complimentary_ticket_count: number;
  raffle_pending_ticket_count: number;
  raffle_voided_ticket_count: number;
  raffle_winner_count: number;
  raffle_pending_revenue_cents: number;
  refunded_registration_amount_cents: number;
}

export interface RegistrationPaymentReportRow {
  id: number;
  type: 'registration';
  name: string;
  partner_name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  registration_status: string;
  payment_status: string;
  payment_type: string;
  payment_method: string | null;
  payment_method_label: string | null;
  amount_cents: number;
  paid_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  receipt_number: string | null;
  payment_notes: string | null;
  source: string | null;
  created_at: string | null;
  refund_amount_cents: number | null;
  refunded_at: string | null;
  refund_reason: string | null;
}

export interface SponsoredRegistrationReportRow {
  id: number;
  type: 'sponsored_registration';
  name: string;
  partner_name: string | null;
  sponsor_name: string | null;
  registration_status: string;
  payment_status: string;
  operationally_cleared: boolean;
  source: string | null;
  created_at: string | null;
  notes: string | null;
}

export interface RaffleSaleReportRow {
  id: number;
  type: 'raffle';
  ticket_number: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  golfer_id: number | null;
  golfer_name: string | null;
  payment_status: string;
  payment_method: string | null;
  payment_method_label: string | null;
  amount_cents: number;
  complimentary: boolean;
  included_with_registration: boolean;
  purchased_at: string | null;
  created_at: string | null;
  sold_by_name: string | null;
  receipt_number: string | null;
  payment_notes: string | null;
  is_winner: boolean;
  prize_won: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface RaffleSaleGroupReportRow {
  id: number | string;
  type: 'raffle_sale_group';
  source: 'recorded_batch' | 'inferred';
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  linked_registration_names: string[];
  payment_status: string;
  payment_method: string | null;
  payment_method_label: string | null;
  ticket_count: number;
  ticket_numbers: string[];
  ticket_range: string;
  amount_cents: number;
  bundle_label: string;
  average_ticket_cents: number;
  purchased_at: string | null;
  sold_by_name: string | null;
  receipt_number: string | null;
  payment_notes: string | null;
}

export interface CombinedLedgerReportRow {
  type: 'registration' | 'registration_refund' | 'raffle';
  name: string;
  detail: string;
  payment_status: string;
  payment_method: string | null;
  amount_cents: number;
  paid_at: string | null;
  reference: string | null;
  notes: string | null;
}

export interface PaymentReport {
  tournament: {
    id: number;
    name: string;
    event_date: string | null;
    entry_fee_cents: number | null;
  };
  summary: PaymentReportSummary;
  registration_payments: RegistrationPaymentReportRow[];
  sponsored_registrations: SponsoredRegistrationReportRow[];
  raffle_sale_groups: RaffleSaleGroupReportRow[];
  raffle_sales: RaffleSaleReportRow[];
  combined_ledger: CombinedLedgerReportRow[];
}

export interface Group {
  id: number;
  tournament_id: number;
  group_number: number;
  starting_course_key: string | null;
  starting_course_name: string | null;
  hole_number: number | null;
  created_at: string;
  updated_at: string;
  golfer_count: number;
  player_count: number;
  max_golfers: number;
  is_full: boolean;
  starting_position_label: string | null;
  hole_position_label: string | null;
  starting_hole_description?: string | null;
  golfers?: Golfer[];
}

export interface AutoAssignResult {
  message: string;
  assigned_count: number;
  failed_count: number;
  failures: Array<{
    golfer_id: number;
    name: string | null;
    errors: string[];
  }>;
}

export interface EmployeeNumber {
  id: number;
  tournament_id: number;
  employee_name: string | null;
  used: boolean;
  used_by_golfer_id: number | null;
  used_by_golfer_name: string | null;
  display_name: string;
  status: string;
  created_at: string;
}

export interface Admin {
  id: number;
  clerk_id: string | null;
  name: string | null;
  email: string;
  role: 'super_admin' | 'admin' | null;
  is_super_admin: boolean;
  org_role: 'admin' | 'member' | 'volunteer' | null;
}

export interface ActivityLog {
  id: number;
  tournament_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_name: string | null;
  details: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  admin_name: string;
  admin_email: string | null;
}

export interface ActivityLogSummary {
  tournament_id: number | null;
  tournament_name: string | null;
  today_count: number;
  total_count: number;
  by_action: Record<string, number>;
  by_admin: Record<string, number>;
  daily_activity: Record<string, number>;
}

// Global settings (shared across tournaments)
export interface Settings {
  id: number;
  stripe_public_key: string | null;
  stripe_secret_key: string | null;
  stripe_webhook_secret: string | null;
  admin_email: string | null;
  payment_mode: 'test' | 'production';
  stripe_configured: boolean;
  test_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
  golfer_id: number;
  test_mode?: boolean;
}

export interface EmbeddedCheckoutSession {
  client_secret: string;
  session_id: string;
  test_mode?: boolean;
  error?: string;
}

export interface PaymentConfirmation {
  success: boolean;
  golfer: Golfer;
  message: string;
}

export interface RegistrationStatus {
  tournament_id: number;
  // Total capacity (for admin reference)
  max_capacity: number;
  confirmed_count: number;
  waitlist_count: number;
  capacity_remaining: number;
  at_capacity: boolean;
  // Public-facing capacity (excludes reserved slots)
  reserved_slots: number;
  public_capacity: number;
  public_capacity_remaining: number;
  public_at_capacity: boolean;
  registration_open: boolean;
  entry_fee_cents: number;
  entry_fee_dollars: number;
  // Employee discount
  employee_entry_fee_cents: number;
  employee_entry_fee_dollars: number;
  employee_discount_available: boolean;
  // Tournament configuration
  tournament_year: number | string;
  tournament_edition: string;
  tournament_title: string;
  tournament_name: string;
  event_date: string;
  registration_time: string;
  start_time: string;
  location_name: string;
  location_address: string;
  format_name: string;
  tournament_info?: string | null;
  // Stripe configuration
  stripe_configured: boolean;
  stripe_public_key: string | null;
  payment_mode: string;
  fee_includes: string;
  checks_payable_to: string;
  contact_name: string;
  contact_phone: string;
}

export interface GolferStats {
  tournament_id: number;
  tournament_name: string;
  total: number;
  confirmed: number;
  waitlist: number;
  paid: number;
  unpaid: number;
  checked_in: number;
  not_checked_in: number;
  assigned_to_groups: number;
  unassigned: number;
  max_capacity: number;
  reserved_slots: number;
  public_capacity: number;
  capacity_remaining: number;
  at_capacity: boolean;
  entry_fee_cents: number;
  entry_fee_dollars: number;
  employee_entry_fee_cents: number;
  employee_entry_fee_dollars: number;
}

export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

// API client class
export class ApiClient {
  private getAuthToken: (() => Promise<string | null>) | null = null;
  private currentTournamentId: number | null = null;
  private userEmail: string | null = null;

  setAuthTokenGetter(getter: () => Promise<string | null>) {
    this.getAuthToken = getter;
  }

  setUserEmail(email: string | null) {
    this.userEmail = email;
  }

  async getWebSocketToken(): Promise<string | null> {
    if (!this.getAuthToken) return null;
    try {
      return await this.getAuthToken();
    } catch {
      return null;
    }
  }

  // Tournament context management
  setCurrentTournament(tournamentId: number | null) {
    this.currentTournamentId = tournamentId;
  }

  getCurrentTournamentId(): number | null {
    return this.currentTournamentId;
  }

  private async getHeaders(authenticated = true): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authenticated && this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated = true
  ): Promise<T> {
    const headers = await this.getHeaders(authenticated);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      // Handle different error formats from the API
      const errorMessage = 
        error.errors?.[0] ||  // Rails array format: { errors: ["message"] }
        error.error ||        // Single error format: { error: "message" }
        error.message ||      // Generic format: { message: "message" }
        'Request failed';
      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async requestWithToken<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      const errorMessage =
        error.errors?.[0] ||
        error.error ||
        error.message ||
        'Request failed';
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Tournament endpoints
  async getTournaments(params?: { status?: string }): Promise<Tournament[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return this.request(`/api/v1/tournaments${query ? `?${query}` : ''}`);
  }

  async getCurrentTournament(): Promise<Tournament> {
    return this.request('/api/v1/tournaments/current', {}, false);
  }

  async getTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}`);
  }

  async createTournament(data: Partial<Tournament>): Promise<Tournament> {
    return this.request('/api/v1/tournaments', {
      method: 'POST',
      body: JSON.stringify({ tournament: data }),
    });
  }

  async updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ tournament: data }),
    });
  }

  async deleteTournament(id: number): Promise<void> {
    return this.request(`/api/v1/tournaments/${id}`, {
      method: 'DELETE',
    });
  }

  async archiveTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}/archive`, {
      method: 'POST',
    });
  }

  async copyTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}/copy`, {
      method: 'POST',
    });
  }

  async openTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}/open`, {
      method: 'POST',
    });
  }

  async closeTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}/close`, {
      method: 'POST',
    });
  }

  async completeTournament(id: number): Promise<Tournament> {
    return this.request(`/api/v1/tournaments/${id}/complete`, {
      method: 'POST',
    });
  }

  // Organization endpoints
  async getOrganization(slug: string): Promise<Organization> {
    return this.request(`/api/v1/organizations/${slug}`, {}, false);
  }

  async getOrganizationTournaments(orgSlug: string): Promise<Tournament[]> {
    return this.request(`/api/v1/organizations/${orgSlug}/tournaments`, {}, false);
  }

  async getAdminOrganizationTournaments(orgSlug: string): Promise<Tournament[]> {
    type AdminTournamentSummary = Tournament & {
      date?: string | null;
      capacity?: number | null;
      pending_count?: number;
      registration_count?: number;
      revenue?: number;
    };

    const response = await this.request<{ tournaments: AdminTournamentSummary[] }>(
      `/api/v1/admin/organizations/${orgSlug}/tournaments`
    );
    const tournaments = Array.isArray(response.tournaments) ? response.tournaments : [];

    return tournaments.map((tournament) => ({
      ...tournament,
      year: tournament.year ?? (tournament.date ? new Date(tournament.date).getFullYear() : new Date().getFullYear()),
      event_date: tournament.event_date ?? tournament.date ?? null,
      max_capacity: tournament.max_capacity ?? tournament.capacity ?? 0,
      confirmed_count: tournament.confirmed_count ?? tournament.registration_count ?? 0,
      public_confirmed_count: tournament.public_confirmed_count ?? tournament.registration_count ?? 0,
      sponsor_confirmed_count: tournament.sponsor_confirmed_count ?? 0,
      pending_payment_count: tournament.pending_payment_count ?? tournament.pending_count ?? 0,
      paid_count: tournament.paid_count ?? 0,
      revenue: tournament.revenue ?? 0,
      event_type: tournament.event_type ?? 'golf_tournament',
      short_name: tournament.short_name ?? tournament.name,
      display_name: tournament.display_name ?? tournament.name,
    }));
  }

  async getOrganizationTournament(orgSlug: string, tournamentSlug: string): Promise<Tournament> {
    return this.request(`/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`, {}, false);
  }

  async getMyOrganizations(): Promise<Organization[]> {
    return this.request('/api/v1/admin/organizations');
  }

  async getMyOrganizationsWithToken(token: string): Promise<Organization[]> {
    return this.requestWithToken('/api/v1/admin/organizations', token);
  }

  async createOrganization(data: Partial<Organization>): Promise<Organization> {
    return this.request('/api/v1/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ organization: data }),
    });
  }

  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    return this.request(`/api/v1/admin/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ organization: data }),
    });
  }

  // Simple axios-like interface for OrganizationProvider
  async get<T = unknown>(url: string): Promise<{ data: T }> {
    const data = await this.request<T>(url.startsWith('/api') ? url : `/api/v1${url}`, {}, false);
    return { data };
  }

  // Public endpoints (no auth required)
  async getRegistrationStatus(): Promise<RegistrationStatus> {
    return this.request('/api/v1/golfers/registration_status', {}, false);
  }

  async registerGolfer(data: {
    golfer: {
      name: string;
      company?: string;
      address?: string;
      phone: string;
      mobile?: string;
      email: string;
      payment_type: 'stripe' | 'pay_on_day' | 'swipe_simple';
      payment_status?: 'paid' | 'unpaid';
      notes?: string;
      partner_name?: string;
      partner_email?: string;
      partner_phone?: string;
      partner_waiver_accepted_at?: string;
      team_name?: string;
      team_category?: string;
      tshirt_size?: string;
      partner_tshirt_size?: string;
      raffle_tickets_requested?: number;
      raffle_bundle_label?: string;
    };
    waiver_accepted: boolean;
    tournament_id?: string | number;
  }): Promise<{ golfer: Golfer; message: string }> {
    return this.request('/api/v1/golfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }, false);
  }

  // Protected endpoints (auth required)
  async getGolfers(params?: {
    tournament_id?: number;
    payment_status?: string;
    payment_type?: string;
    registration_status?: string;
    checked_in?: string;
    assigned?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ golfers: Golfer[]; meta: PaginationMeta }> {
    const searchParams = new URLSearchParams();
    // Add tournament_id if set
    const tournamentId = params?.tournament_id || this.currentTournamentId;
    if (tournamentId) {
      searchParams.append('tournament_id', String(tournamentId));
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'tournament_id' && value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/api/v1/golfers${query ? `?${query}` : ''}`);
  }

  async getPaymentReport(tournamentId?: number): Promise<PaymentReport | null> {
    const id = tournamentId || this.currentTournamentId;
    if (!id) {
      return null;
    }
    return this.request(`/api/v1/tournaments/${id}/payment_report`);
  }

  async getGolfer(id: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}`);
  }

  async updateGolfer(id: number, data: Partial<Golfer>): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ golfer: data }),
    });
  }

  async deleteGolfer(id: number): Promise<void> {
    return this.request(`/api/v1/golfers/${id}`, {
      method: 'DELETE',
    });
  }

  async checkInGolfer(id: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/check_in`, {
      method: 'POST',
    });
  }

  async addPaymentDetails(id: number, data: {
    payment_method: string;
    receipt_number?: string;
    payment_notes?: string;
  }): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/payment_details`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async promoteGolfer(id: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/promote`, {
      method: 'POST',
    });
  }

  async demoteGolfer(id: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/demote`, {
      method: 'POST',
    });
  }

  async updatePaymentStatus(id: number, paymentStatus: 'paid' | 'unpaid'): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/update_payment_status`, {
      method: 'POST',
      body: JSON.stringify({ payment_status: paymentStatus }),
    });
  }

  async cancelGolfer(id: number, reason?: string): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async refundGolfer(id: number, reason?: string): Promise<{ success: boolean; golfer: Golfer; refund: { id: string; amount: number; status: string }; message: string }> {
    return this.request(`/api/v1/golfers/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async markGolferRefunded(id: number, reason?: string, refundAmountCents?: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${id}/mark_refunded`, {
      method: 'POST',
      body: JSON.stringify({ reason, refund_amount_cents: refundAmountCents }),
    });
  }

  // Payment Links
  async sendPaymentLink(golferId: number): Promise<{ success: boolean; message: string; payment_link: string }> {
    return this.request(`/api/v1/golfers/${golferId}/send_payment_link`, {
      method: 'POST',
    });
  }

  async toggleEmployee(golferId: number): Promise<Golfer> {
    return this.request(`/api/v1/golfers/${golferId}/toggle_employee`, {
      method: 'POST',
    });
  }

  // Bulk actions
  async bulkSetEmployee(golferIds: number[], isEmployee: boolean): Promise<{
    success: boolean;
    message: string;
    updated_count: number;
    skipped_count: number;
    skipped_reasons?: Array<{ name: string; reason: string }>;
    golfers: Golfer[];
  }> {
    const tournamentId = this.currentTournamentId;
    return this.request('/api/v1/golfers/bulk_set_employee', {
      method: 'POST',
      body: JSON.stringify({ 
        golfer_ids: golferIds, 
        is_employee: isEmployee,
        tournament_id: tournamentId
      }),
    });
  }

  async bulkSendPaymentLinks(golferIds: number[]): Promise<{
    success: boolean;
    message: string;
    sent_count: number;
    skipped_count: number;
    skipped_reasons: Array<{ name: string; reason: string }>;
  }> {
    const tournamentId = this.currentTournamentId;
    return this.request('/api/v1/golfers/bulk_send_payment_links', {
      method: 'POST',
      body: JSON.stringify({ 
        golfer_ids: golferIds,
        tournament_id: tournamentId
      }),
    });
  }

  async getPaymentLinkInfo(token: string): Promise<{
    golfer: { id: number; name: string; email: string; phone: string; company: string; is_employee: boolean; registration_status: string };
    tournament: { id: number; name: string; event_date: string };
    entry_fee_cents: number;
    entry_fee_dollars: number;
  }> {
    return this.request(`/api/v1/payment_links/${token}`, {}, false);
  }

  async createPaymentLinkCheckout(token: string): Promise<{ client_secret: string; session_id: string; test_mode?: boolean; success?: boolean; message?: string }> {
    return this.request(`/api/v1/payment_links/${token}/checkout`, {
      method: 'POST',
    }, false);
  }

  async getGolferStats(tournamentId?: number): Promise<GolferStats> {
    const id = tournamentId || this.currentTournamentId;
    const query = id ? `?tournament_id=${id}` : '';
    return this.request(`/api/v1/golfers/stats${query}`);
  }

  // Groups
  async getGroups(tournamentId?: number): Promise<Group[]> {
    const id = tournamentId || this.currentTournamentId;
    const query = id ? `?tournament_id=${id}` : '';
    return this.request(`/api/v1/groups${query}`);
  }

  async getGroup(id: number): Promise<Group> {
    return this.request(`/api/v1/groups/${id}`);
  }

  async createGroup(
    options?: { startingCourseKey?: string | null; holeNumber?: number | null },
    tournamentId?: number
  ): Promise<Group> {
    const id = tournamentId || this.currentTournamentId;
    return this.request('/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify({ 
        starting_course_key: options?.startingCourseKey,
        hole_number: options?.holeNumber,
        tournament_id: id
      }),
    });
  }

  async updateGroup(id: number, data: Partial<Group>): Promise<Group> {
    return this.request(`/api/v1/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ group: data }),
    });
  }

  async deleteGroup(id: number): Promise<void> {
    return this.request(`/api/v1/groups/${id}`, {
      method: 'DELETE',
    });
  }

  async setGroupHole(id: number, startingCourseKey: string | null, holeNumber: number | null): Promise<Group> {
    return this.request(`/api/v1/groups/${id}/set_hole`, {
      method: 'POST',
      body: JSON.stringify({ starting_course_key: startingCourseKey, hole_number: holeNumber }),
    });
  }

  async addGolferToGroup(groupId: number, golferId: number): Promise<Group> {
    return this.request(`/api/v1/groups/${groupId}/add_golfer`, {
      method: 'POST',
      body: JSON.stringify({ golfer_id: golferId }),
    });
  }

  async removeGolferFromGroup(groupId: number, golferId: number): Promise<Group> {
    return this.request(`/api/v1/groups/${groupId}/remove_golfer`, {
      method: 'POST',
      body: JSON.stringify({ golfer_id: golferId }),
    });
  }

  async updateGroupPositions(updates: Array<{
    golfer_id: number;
    group_id: number | null;
    position: number | null;
  }>): Promise<{ message: string }> {
    return this.request('/api/v1/groups/update_positions', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  async batchCreateGroups(count: number, tournamentId?: number): Promise<Group[]> {
    const id = tournamentId || this.currentTournamentId;
    return this.request('/api/v1/groups/batch_create', {
      method: 'POST',
      body: JSON.stringify({ count, tournament_id: id }),
    });
  }

  async autoAssignGolfers(tournamentId?: number): Promise<AutoAssignResult> {
    const id = tournamentId || this.currentTournamentId;
    return this.request('/api/v1/groups/auto_assign', {
      method: 'POST',
      body: JSON.stringify({ tournament_id: id }),
    });
  }

  // Admins
  async getCurrentAdmin(): Promise<Admin> {
    return this.request('/api/v1/admins/me');
  }

  async getAdmins(): Promise<Admin[]> {
    return this.request('/api/v1/admins');
  }

  async createAdmin(data: { email: string; name?: string }): Promise<Admin> {
    return this.request('/api/v1/admins', {
      method: 'POST',
      body: JSON.stringify({ admin: data }),
    });
  }

  async updateAdmin(id: number, data: Partial<Admin>): Promise<Admin> {
    return this.request(`/api/v1/admins/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ admin: data }),
    });
  }

  async deleteAdmin(id: number): Promise<void> {
    return this.request(`/api/v1/admins/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings (global only)
  async getSettings(): Promise<Settings> {
    return this.request('/api/v1/settings');
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    return this.request('/api/v1/settings', {
      method: 'PATCH',
      body: JSON.stringify({ setting: data }),
    });
  }

  // Checkout / Stripe
  async createCheckoutSession(golferId: number): Promise<CheckoutSession> {
    return this.request('/api/v1/checkout', {
      method: 'POST',
      body: JSON.stringify({ golfer_id: golferId }),
    }, false);
  }

  async createEmbeddedCheckout(golferData: {
    name: string;
    email: string;
    phone: string;
    mobile?: string;
    company?: string;
    address?: string;
  }, employeeNumber?: string, tournamentId?: string | number): Promise<EmbeddedCheckoutSession> {
    return this.request('/api/v1/checkout/embedded', {
      method: 'POST',
      body: JSON.stringify({ 
        golfer: golferData,
        employee_number: employeeNumber,
        tournament_id: tournamentId,
      }),
    }, false);
  }

  async createSwipeSimpleCheckout(golferId: number): Promise<{ redirect_url: string }> {
    return this.request('/api/v1/checkout/swipe_simple', {
      method: 'POST',
      body: JSON.stringify({ golfer_id: golferId }),
    }, false);
  }

  async confirmPayment(sessionId: string): Promise<PaymentConfirmation> {
    return this.request('/api/v1/checkout/confirm', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }, false);
  }

  async getCheckoutSessionStatus(sessionId: string): Promise<{
    session_id: string;
    payment_status: string;
    status: string;
    golfer_id: number | null;
    golfer_name: string | null;
    amount_total: number | null;
  }> {
    return this.request(`/api/v1/checkout/session/${sessionId}`, {}, false);
  }

  // Activity Logs
  async getActivityLogs(params?: {
    tournament_id?: number;
    all_tournaments?: boolean;
    page?: number;
    per_page?: number;
    admin_id?: number;
    action_type?: string;
    target_type?: string;
    target_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<{ activity_logs: ActivityLog[]; meta: { current_page: number; per_page: number; total_count: number; total_pages: number } }> {
    const searchParams = new URLSearchParams();
    const tournamentId = params?.tournament_id || this.currentTournamentId;
    if (tournamentId && !params?.all_tournaments) {
      searchParams.set('tournament_id', tournamentId.toString());
    }
    if (params?.all_tournaments) searchParams.set('all_tournaments', 'true');
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.admin_id) searchParams.set('admin_id', params.admin_id.toString());
    if (params?.action_type) searchParams.set('action_type', params.action_type);
    if (params?.target_type) searchParams.set('target_type', params.target_type);
    if (params?.target_id) searchParams.set('target_id', params.target_id.toString());
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    
    const query = searchParams.toString();
    return this.request(`/api/v1/activity_logs${query ? `?${query}` : ''}`);
  }

  async getActivityLogSummary(tournamentId?: number): Promise<ActivityLogSummary> {
    const id = tournamentId || this.currentTournamentId;
    const query = id ? `?tournament_id=${id}` : '';
    return this.request(`/api/v1/activity_logs/summary${query}`);
  }

  async getGolferActivityHistory(golferId: number): Promise<{ activity_logs: ActivityLog[]; golfer_id: number; golfer_name: string }> {
    return this.request(`/api/v1/activity_logs/golfer/${golferId}`);
  }

}

// Export singleton instance
export const api = new ApiClient();
