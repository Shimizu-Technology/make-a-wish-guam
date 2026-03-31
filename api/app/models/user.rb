# frozen_string_literal: true

class User < ApplicationRecord
  # Associations
  has_many :activity_logs, foreign_key: :admin_id, dependent: :nullify, inverse_of: :user
  has_many :organization_memberships, dependent: :destroy
  has_many :organizations, through: :organization_memberships
  has_many :tournament_assignments, dependent: :destroy
  has_many :assigned_tournaments, through: :tournament_assignments, source: :tournament

  # Validations
  validates :clerk_id, uniqueness: true, allow_nil: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :role, inclusion: { in: %w[super_admin org_admin tournament_admin] }

  # Callbacks
  before_validation :normalize_email
  before_validation :set_default_role, on: :create

  # Scopes
  scope :super_admins, -> { where(role: 'super_admin') }
  scope :org_admins, -> { where(role: 'org_admin') }
  scope :tournament_admins, -> { where(role: 'tournament_admin') }

  # Role constants
  ROLES = %w[super_admin org_admin tournament_admin].freeze

  # Find user by clerk_id or email
  def self.find_by_clerk_or_email(clerk_id:, email:)
    user = find_by(clerk_id: clerk_id) if clerk_id.present?
    return user if user

    find_by('LOWER(email) = ?', email&.downcase) if email.present?
  end

  # Role checks
  def super_admin?
    role == 'super_admin'
  end

  def org_admin?
    role == 'org_admin' || super_admin?
  end

  def tournament_admin?
    role == 'tournament_admin' || org_admin?
  end

  # Organization access checks
  def org_admin_for?(organization)
    return true if super_admin?
    organization_memberships.exists?(organization: organization, role: 'admin')
  end

  def member_of?(organization)
    return true if super_admin?
    organization_memberships.exists?(organization: organization)
  end

  # Tournament access checks
  def can_manage?(tournament)
    return true if super_admin?
    return true if org_admin_for?(tournament.organization)
    tournament_assignments.exists?(tournament: tournament)
  end

  def accessible_organizations
    return Organization.all if super_admin?
    organizations
  end

  def accessible_tournaments
    return Tournament.all if super_admin?
    
    org_ids = organization_memberships.where(role: 'admin').pluck(:organization_id)
    tournament_ids = tournament_assignments.pluck(:tournament_id)
    
    Tournament.where(organization_id: org_ids).or(Tournament.where(id: tournament_ids))
  end

  private

  def normalize_email
    self.email = email&.downcase&.strip
  end

  def set_default_role
    self.role ||= 'org_admin'
  end
end
