# frozen_string_literal: true

class Organization < ApplicationRecord
  # Associations
  has_many :tournaments, dependent: :restrict_with_error
  has_many :organization_memberships, dependent: :destroy
  has_many :users, through: :organization_memberships

  # Validations
  validates :name, presence: true
  validates :slug, presence: true, 
                   uniqueness: { case_sensitive: false },
                   format: { with: /\A[a-z0-9\-]+\z/, message: 'only allows lowercase letters, numbers, and hyphens' }
  validates :primary_color, format: { with: /\A#[0-9A-Fa-f]{6}\z/, message: 'must be a valid hex color' }, allow_blank: true
  validates :contact_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :subscription_status, inclusion: { in: %w[active past_due canceled trialing] }

  # Callbacks
  before_validation :generate_slug, on: :create

  # Scopes
  scope :active, -> { where(subscription_status: 'active') }

  # Class methods
  def self.find_by_slug!(slug)
    find_by!(slug: slug.downcase)
  end

  # Instance methods
  def active?
    subscription_status == 'active'
  end

  def tournament_count
    tournaments.count
  end

  def admin_count
    organization_memberships.where(role: 'admin').count
  end

  def add_admin(user)
    organization_memberships.find_or_create_by!(user: user) do |membership|
      membership.role = 'admin'
    end
  end

  def add_member(user, role: 'member')
    organization_memberships.find_or_create_by!(user: user) do |membership|
      membership.role = role
    end
  end

  def remove_member(user)
    organization_memberships.find_by(user: user)&.destroy
  end

  def member?(user)
    organization_memberships.exists?(user: user)
  end

  def admin?(user)
    organization_memberships.exists?(user: user, role: 'admin')
  end

  private

  def generate_slug
    return if slug.present?
    return unless name.present?

    base_slug = name.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/^-|-$/, '')
    
    # Ensure uniqueness
    candidate = base_slug
    counter = 1
    while Organization.exists?(slug: candidate)
      candidate = "#{base_slug}-#{counter}"
      counter += 1
    end
    
    self.slug = candidate
  end
end
