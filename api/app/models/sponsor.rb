# frozen_string_literal: true

class Sponsor < ApplicationRecord
  # Associations
  belongs_to :tournament
  has_many :sponsor_slots, dependent: :destroy
  has_many :golfers, dependent: :nullify
  has_one_attached :logo

  # Legacy constant kept for backwards compatibility with scopes/seeds.
  DEFAULT_TIERS = %w[title platinum gold silver bronze hole].freeze
  TIERS = DEFAULT_TIERS

  # Validations
  validates :name, presence: true
  validate :tier_must_be_valid
  validate :course_key_must_exist_in_tournament, if: :hole_sponsor?
  validate :hole_number_within_course_range, if: :hole_sponsor?
  validates :hole_number,
            numericality: { only_integer: true, greater_than: 0 },
            allow_nil: true
  validates :hole_number, presence: true, if: -> { tier == 'hole' }
  validates :course_key, presence: true, if: -> { tier == 'hole' }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  before_validation :normalize_hole_assignment

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_tier, ->(tier) { where(tier: tier) }
  scope :ordered, -> { order(:tier, :position, :name) }
  scope :title_sponsors, -> { where(tier: 'title') }
  scope :major_sponsors, -> { where(tier: %w[title platinum gold]) }
  scope :hole_sponsors, -> { where(tier: 'hole').order(:course_key, :hole_number, :position, :name) }

  def tier_display
    tier_def = tournament&.sponsor_tier_list&.find { |t| t['key'] == tier }
    return tier_def['label'] if tier_def

    tier&.titleize || 'Sponsor'
  end

  def tier_priority
    keys = tournament&.sponsor_tier_keys || DEFAULT_TIERS
    keys.index(tier) || 999
  end

  def major?
    tier_priority <= 1
  end

  def hole_sponsor?
    tier == 'hole'
  end

  def course_name
    return nil unless course_key.present?

    tournament&.course_name_for(course_key)
  end

  # Display label
  def display_label
    return tier_display unless hole_sponsor? && course_key.present? && hole_number.present?

    "#{course_name} #{hole_number}"
  end

  # Auto-sync SponsorSlot records when slot_count changes
  after_save :sync_sponsor_slots

  # Magic link authentication
  ACCESS_TOKEN_EXPIRY = 7.days
  PORTAL_SESSION_EXPIRY = 12.hours

  def generate_access_token!
    token = SecureRandom.urlsafe_base64(32)
    update!(
      access_token: token,
      access_token_expires_at: Time.current + ACCESS_TOKEN_EXPIRY
    )
    token
  end

  def generate_portal_session_token!(verified_email:)
    normalized_email = verified_email.to_s.strip.downcase
    raise ArgumentError, 'Verified email is required' if normalized_email.blank?

    self.class.portal_session_verifier.generate(
      { 'sponsor_id' => id, 'email' => normalized_email },
      expires_in: PORTAL_SESSION_EXPIRY
    )
  end

  def access_token_valid?
    access_token.present? &&
      access_token_expires_at.present? &&
      access_token_expires_at > Time.current
  end

  def self.find_by_access_token(token)
    return nil if token.blank?
    sponsor = find_by(access_token: token)
    return nil unless sponsor&.access_token_valid?
    sponsor
  end

  def self.find_by_portal_session_token(token)
    return nil if token.blank?

    payload = portal_session_verifier.verified(token)
    return nil unless payload.is_a?(Hash)

    sponsor = find_by(id: payload['sponsor_id'])
    return nil unless sponsor

    verified_email = payload['email'].to_s.downcase
    return nil unless sponsor.login_email.to_s.downcase == verified_email

    sponsor
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    nil
  end

  def self.portal_session_verifier
    Rails.application.message_verifier('sponsor-portal-session')
  end

  private

  def normalize_hole_assignment
    self.course_key = course_key.presence
    self.hole_number = hole_number.presence

    unless hole_sponsor?
      self.course_key = nil
      self.hole_number = nil
      return
    end

    if course_key.blank? && tournament.present? && !tournament.multi_course_setup?
      self.course_key = tournament.default_course_key
    end
  end

  def tier_must_be_valid
    return if tier.blank?
    allowed = tournament&.sponsor_tier_keys || DEFAULT_TIERS
    return if allowed.include?(tier)
    errors.add(:tier, "must be one of: #{allowed.join(', ')}")
  end

  def course_key_must_exist_in_tournament
    return unless course_key.present? && tournament.present?
    return if tournament.course_config_for(course_key).present?

    errors.add(:course_key, "is not configured for this event")
  end

  def hole_number_within_course_range
    return unless course_key.present? && hole_number.present? && tournament.present?
    return if errors[:course_key].present?

    max_holes = tournament.hole_count_for_course(course_key)
    unless max_holes.positive?
      errors.add(:course_key, "is not configured for a valid hole range")
      return
    end
    return if hole_number <= max_holes

    errors.add(:hole_number, "must be between 1 and #{max_holes} for #{course_name}")
  end

  def sync_sponsor_slots
    return unless saved_change_to_slot_count?
    current_count = sponsor_slots.count
    target_count = slot_count.to_i

    if target_count > current_count
      # Add new slots
      tournament_record = self.tournament
      (current_count + 1..target_count).each do |num|
        sponsor_slots.find_or_create_by!(slot_number: num, tournament: tournament_record)
      end
    elsif target_count < current_count
      # Remove extra slots (remove unfilled ones first, then filled ones)
      to_remove = sponsor_slots.order(player_name: :asc).last(current_count - target_count)
      to_remove.each(&:destroy)
    end
  end
end
