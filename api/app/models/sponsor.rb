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
  validates :hole_number,
            numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 18 },
            allow_nil: true
  validates :hole_number, presence: true, if: -> { tier == 'hole' }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_tier, ->(tier) { where(tier: tier) }
  scope :ordered, -> { order(:tier, :position, :name) }
  scope :title_sponsors, -> { where(tier: 'title') }
  scope :major_sponsors, -> { where(tier: %w[title platinum gold]) }
  scope :hole_sponsors, -> { where(tier: 'hole').order(:hole_number) }

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
    hole_number.present?
  end

  # Display label
  def display_label
    hole_sponsor? ? "Hole #{hole_number}" : tier_display
  end

  # Auto-sync SponsorSlot records when slot_count changes
  after_save :sync_sponsor_slots

  # Magic link authentication
  ACCESS_TOKEN_EXPIRY = 7.days

  def generate_access_token!
    token = SecureRandom.urlsafe_base64(32)
    update!(
      access_token: token,
      access_token_expires_at: Time.current + ACCESS_TOKEN_EXPIRY
    )
    token
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

  private

  def tier_must_be_valid
    return if tier.blank?
    allowed = tournament&.sponsor_tier_keys || DEFAULT_TIERS
    return if allowed.include?(tier)
    errors.add(:tier, "must be one of: #{allowed.join(', ')}")
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
