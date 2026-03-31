# frozen_string_literal: true

class Tournament < ApplicationRecord
  # Associations
  belongs_to :organization
  has_many :golfers, dependent: :restrict_with_error
  has_many :groups, dependent: :restrict_with_error
  has_many :scores, dependent: :destroy
  has_many :raffle_prizes, dependent: :destroy
  has_many :raffle_tickets, dependent: :destroy
  has_many :sponsors, dependent: :destroy
  has_many :activity_logs, dependent: :nullify
  has_many :tournament_assignments, dependent: :destroy
  has_many :assigned_users, through: :tournament_assignments, source: :user

  # Validations
  validates :name, presence: true
  validates :year, presence: true, numericality: { only_integer: true }
  validates :status, presence: true, inclusion: { in: %w[draft open closed in_progress completed archived] }
  validates :max_capacity, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :entry_fee, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :slug, uniqueness: { scope: :organization_id, case_sensitive: false }, allow_blank: true

  # Callbacks
  before_validation :generate_slug, on: :create

  # Scopes
  scope :active, -> { where.not(status: 'archived') }
  scope :archived, -> { where(status: 'archived') }
  scope :open_for_registration, -> { where(status: 'open', registration_open: true) }
  scope :by_year, ->(year) { where(year: year) }
  scope :recent, -> { order(year: :desc, created_at: :desc) }
  scope :for_organization, ->(org) { where(organization: org) }

  # Status constants
  STATUSES = %w[draft open closed in_progress completed archived].freeze
  
  # Format constants
  FORMATS = %w[scramble stroke stableford best_ball match captain_choice custom].freeze
  
  # Scoring type constants
  SCORING_TYPES = %w[gross net both stableford].freeze
  
  # Format validations
  validates :tournament_format, inclusion: { in: FORMATS }, allow_nil: true
  validates :scoring_type, inclusion: { in: SCORING_TYPES }, allow_nil: true
  validates :team_size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 4 }, allow_nil: true
  
  # Alias for backwards compatibility with 'format_name' column
  def format
    tournament_format
  end

  # Class methods
  def self.current
    # Returns the currently open tournament (for public registration)
    open_for_registration.first || active.recent.first
  end

  def self.find_by_org_and_slug!(organization, slug)
    for_organization(organization).find_by!(slug: slug.downcase)
  end

  # Status checks
  def draft?
    status == 'draft'
  end

  def open?
    status == 'open'
  end

  def closed?
    status == 'closed'
  end

  def in_progress?
    status == 'in_progress'
  end

  def completed?
    status == 'completed'
  end

  def archived?
    status == 'archived'
  end

  def can_register?
    open? && registration_open?
  end

  # Money helpers
  def entry_fee_dollars
    return 0.00 if entry_fee.nil?
    entry_fee / 100.0
  end

  def early_bird_fee_dollars
    return 0.00 if early_bird_fee.nil?
    early_bird_fee / 100.0
  end

  def current_fee
    early_bird_active? ? early_bird_fee : entry_fee
  end

  def current_fee_dollars
    (current_fee || 0) / 100.0
  end

  # Early bird pricing
  def early_bird_active?
    return false if early_bird_fee.nil? || early_bird_deadline.nil?
    Time.current < early_bird_deadline
  end

  def early_bird_expired?
    return true if early_bird_deadline.nil?
    Time.current >= early_bird_deadline
  end

  # Registration deadlines
  def registration_deadline_passed?
    return false if registration_deadline.nil?
    Time.current >= registration_deadline
  end

  def can_register?
    open? && registration_open? && !registration_deadline_passed? && !at_capacity?
  end

  # Capacity helpers
  def confirmed_count
    golfers.confirmed.count
  end

  def waitlist_count
    golfers.waitlist.count
  end

  def capacity_remaining
    return nil if max_capacity.nil?
    remaining = max_capacity - confirmed_count
    remaining.negative? ? 0 : remaining
  end

  def public_capacity
    return max_capacity if max_capacity.nil?
    public_cap = max_capacity - (reserved_slots || 0)
    public_cap.negative? ? 0 : public_cap
  end

  def public_capacity_remaining
    return public_capacity if public_capacity.nil?
    remaining = public_capacity - confirmed_count
    remaining.negative? ? 0 : remaining
  end

  def public_at_capacity?
    return false if max_capacity.nil?
    confirmed_count >= public_capacity
  end

  def at_capacity?
    return false if max_capacity.nil?
    confirmed_count >= max_capacity
  end

  # Stats
  def checked_in_count
    golfers.checked_in.count
  end

  def paid_count
    golfers.paid.count
  end

  # Display helpers
  def display_name
    "#{edition} #{name} (#{year})".strip
  end

  def short_name
    "#{year} Tournament"
  end

  def full_url(base_url = nil)
    return nil unless organization
    base = base_url || ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    "#{base}/#{organization.slug}/tournaments/#{slug}"
  end

  # Actions
  def archive!
    update!(status: 'archived', registration_open: false)
  end

  def open_registration!
    update!(status: 'open', registration_open: true)
  end

  def close_registration!
    update!(registration_open: false)
  end

  def start!
    update!(status: 'in_progress', registration_open: false)
  end

  def complete!
    update!(status: 'completed')
  end

  # Copy tournament for next year
  def copy_for_next_year
    Tournament.new(
      organization: organization,
      name: name,
      year: year + 1,
      edition: increment_edition,
      status: 'draft',
      event_date: nil,
      registration_time: registration_time,
      start_time: start_time,
      location_name: location_name,
      location_address: location_address,
      max_capacity: max_capacity,
      reserved_slots: reserved_slots,
      entry_fee: entry_fee,
      format_name: format_name,
      fee_includes: fee_includes,
      checks_payable_to: checks_payable_to,
      contact_name: contact_name,
      contact_phone: contact_phone,
      registration_open: false
    )
  end

  private

  def generate_slug
    return if slug.present?
    return unless name.present?

    base_slug = name.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/^-|-$/, '')
    base_slug = "#{base_slug}-#{year}" if year.present?
    
    # Ensure uniqueness within organization
    candidate = base_slug
    counter = 1
    while Tournament.exists?(organization_id: organization_id, slug: candidate)
      candidate = "#{base_slug}-#{counter}"
      counter += 1
    end
    
    self.slug = candidate
  end

  def increment_edition
    return '1st' if edition.blank?
    
    current_num = edition.to_i
    next_num = current_num + 1
    
    case next_num
    when 1 then '1st'
    when 2 then '2nd'
    when 3 then '3rd'
    else "#{next_num}th"
    end
  end
end
