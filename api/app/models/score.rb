# frozen_string_literal: true

class Score < ApplicationRecord
  # Associations
  belongs_to :tournament
  belongs_to :golfer, optional: true  # Optional for team scores
  belongs_to :group
  belongs_to :entered_by, class_name: 'User', optional: true

  # Validations
  validates :hole, presence: true, 
                   numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 18 }
  validates :strokes, presence: true, 
                      numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 20 }
  validates :score_type, inclusion: { in: %w[individual team gross net] }
  
  # Ensure unique score per hole per golfer/group
  validates :hole, uniqueness: { 
    scope: [:tournament_id, :golfer_id, :group_id, :score_type],
    message: 'already has a score recorded'
  }

  # Callbacks
  before_save :calculate_relative_score
  before_save :set_par_from_tournament
  after_save :broadcast_score_update

  # Scopes
  scope :for_hole, ->(hole) { where(hole: hole) }
  scope :verified, -> { where(verified: true) }
  scope :unverified, -> { where(verified: false) }
  scope :individual, -> { where(score_type: 'individual') }
  scope :team, -> { where(score_type: 'team') }
  scope :for_group, ->(group) { where(group: group) }
  scope :for_golfer, ->(golfer) { where(golfer: golfer) }
  scope :ordered, -> { order(:hole) }

  # Score types
  SCORE_TYPES = %w[individual team gross net].freeze

  # Hole completed?
  def complete?
    strokes.present?
  end

  # Descriptive relative score
  def relative_score_name
    return nil unless relative_score
    
    case relative_score
    when ..-3 then 'Albatross'
    when -2 then 'Eagle'
    when -1 then 'Birdie'
    when 0 then 'Par'
    when 1 then 'Bogey'
    when 2 then 'Double Bogey'
    when 3 then 'Triple Bogey'
    else "+#{relative_score}"
    end
  end

  # Short description
  def display
    return "#{strokes} (#{relative_score_name})" if relative_score
    strokes.to_s
  end

  # Verify the score
  def verify!(user = nil)
    update!(
      verified: true,
      verified_at: Time.current
    )
  end

  # Class methods for leaderboard
  class << self
    # Total strokes for a golfer in tournament
    def total_strokes_for(golfer)
      where(golfer: golfer).sum(:strokes)
    end

    # Total relative score for a golfer
    def total_relative_for(golfer)
      where(golfer: golfer).sum(:relative_score)
    end

    # Holes completed count for a golfer
    def holes_completed_for(golfer)
      where(golfer: golfer).count
    end
  end

  private

  def calculate_relative_score
    return unless strokes.present? && par.present?
    self.relative_score = strokes - par
  end

  def set_par_from_tournament
    return if par.present?
    return unless tournament && hole
    
    # Get par from tournament's hole_pars config
    hole_pars = tournament.hole_pars || {}
    self.par = hole_pars[hole.to_s]&.to_i || 4  # Default to par 4
  end

  def broadcast_score_update
    # Broadcast to ActionCable for real-time updates
    ActionCable.server.broadcast(
      "tournament_#{tournament_id}_scores",
      {
        action: 'score_update',
        score: as_json(
          only: [:id, :hole, :strokes, :par, :relative_score, :score_type],
          include: {
            golfer: { only: [:id, :name] },
            group: { only: [:id, :group_number] }
          }
        ),
        leaderboard_updated: true
      }
    )
  rescue => e
    Rails.logger.error "Failed to broadcast score: #{e.message}"
  end
end
