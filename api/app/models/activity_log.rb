class ActivityLog < ApplicationRecord
  belongs_to :user, foreign_key: :admin_id, optional: true
  belongs_to :tournament, optional: true
  
  # Alias for backwards compatibility
  alias_method :admin, :user
  alias_method :admin=, :user=

  # Action types
  ACTIONS = %w[
    golfer_created
    golfer_updated
    golfer_deleted
    golfer_checked_in
    golfer_unchecked
    golfer_promoted
    golfer_demoted
    golfer_cancelled
    golfer_refunded
    payment_marked
    payment_updated
    payment_completed
    payment_link_sent
    payment_notes_updated
    group_created
    group_updated
    group_deleted
    golfer_assigned_to_group
    golfer_removed_from_group
    settings_updated
    admin_created
    admin_deleted
    tournament_created
    tournament_updated
    tournament_archived
    employee_status_changed
    bulk_employee_update
    bulk_payment_links_sent
  ].freeze

  validates :action, presence: true, inclusion: { in: ACTIONS }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_admin, ->(admin_id) { where(admin_id: admin_id) }
  scope :by_action, ->(action) { where(action: action) }
  scope :by_target, ->(type, id) { where(target_type: type, target_id: id) }
  scope :today, -> { where(created_at: Time.current.beginning_of_day..Time.current.end_of_day) }
  scope :for_tournament, ->(tournament_id) { where(tournament_id: tournament_id) }

  # Helper method to create logs easily
  def self.log(admin:, action:, target: nil, details: nil, metadata: {}, tournament: nil)
    # Include admin identifier in metadata for traceability
    enriched_metadata = metadata.merge(
      admin_email: admin&.email,
      admin_name: admin&.name
    )

    # Try to infer tournament from target if not provided
    inferred_tournament = tournament || (target.respond_to?(:tournament) ? target.tournament : nil)
    
    create!(
      admin: admin,
      action: action,
      tournament: inferred_tournament,
      target_type: target&.class&.name,
      target_id: target&.id,
      target_name: target.respond_to?(:name) ? target.name : target&.to_s,
      details: details,
      metadata: enriched_metadata
    )
  end
  
  # Get the display name for the admin who performed this action
  def admin_display_name
    user&.name.presence || user&.email || metadata&.dig('admin_email') || 'System'
  end
end
