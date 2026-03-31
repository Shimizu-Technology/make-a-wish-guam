# frozen_string_literal: true

class OrganizationMembership < ApplicationRecord
  belongs_to :user
  belongs_to :organization

  validates :role, presence: true, inclusion: { in: %w[admin member] }
  validates :user_id, uniqueness: { scope: :organization_id, message: 'is already a member of this organization' }

  scope :admins, -> { where(role: 'admin') }
  scope :members, -> { where(role: 'member') }

  def admin?
    role == 'admin'
  end

  def member?
    role == 'member'
  end

  def promote_to_admin!
    update!(role: 'admin')
  end

  def demote_to_member!
    update!(role: 'member')
  end
end
