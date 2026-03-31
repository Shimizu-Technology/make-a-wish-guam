# frozen_string_literal: true

class Sponsor < ApplicationRecord
  # Associations
  belongs_to :tournament

  # Tiers (ordered by importance)
  TIERS = %w[title platinum gold silver bronze hole].freeze

  # Validations
  validates :name, presence: true
  validates :tier, inclusion: { in: TIERS }
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

  # Tier display name
  def tier_display
    case tier
    when 'title' then 'Title Sponsor'
    when 'platinum' then 'Platinum Sponsor'
    when 'gold' then 'Gold Sponsor'
    when 'silver' then 'Silver Sponsor'
    when 'bronze' then 'Bronze Sponsor'
    when 'hole' then "Hole #{hole_number} Sponsor"
    else tier.titleize
    end
  end

  # Tier priority for sorting (lower = higher priority)
  def tier_priority
    TIERS.index(tier) || 999
  end

  # Check if this is a major sponsor (shown prominently)
  def major?
    %w[title platinum gold].include?(tier)
  end

  # Check if this is a hole sponsor
  def hole_sponsor?
    tier == 'hole'
  end

  # Display label
  def display_label
    hole_sponsor? ? "Hole #{hole_number}" : tier_display
  end
end
