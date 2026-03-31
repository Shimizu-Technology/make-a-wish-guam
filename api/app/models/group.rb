class Group < ApplicationRecord
  belongs_to :tournament
  has_many :golfers, dependent: :nullify

  validates :group_number, presence: true, uniqueness: { scope: :tournament_id }
  validates :hole_number, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 18 }, allow_nil: true
  validates :tournament_id, presence: true

  scope :with_golfers, -> { includes(:golfers).order(:group_number) }
  scope :for_tournament, ->(tournament_id) { where(tournament_id: tournament_id) }

  # Maximum golfers per group
  MAX_GOLFERS = 4

  def full?
    golfers.count >= MAX_GOLFERS
  end

  # Hole-based label for the group (e.g., "7A" for first foursome at Hole 7)
  # Always includes a letter suffix for consistency
  def hole_position_label
    return "Unassigned" unless hole_number

    # Get all groups at this hole, sorted by group_number for consistent ordering
    groups_at_hole = Group.where(
      tournament_id: tournament_id,
      hole_number: hole_number
    ).order(:group_number)

    # Find this group's index among all groups at this hole
    group_ids = groups_at_hole.pluck(:id)
    position_index = group_ids.index(id)
    
    # Always add letter suffix for consistency
    position_letter = ('A'..'Z').to_a[position_index] || 'X'
    "#{hole_number}#{position_letter}"
  end

  def golfer_labels
    golfers.order(:position).map.with_index do |golfer, index|
      letter = ("a".."d").to_a[index]
      { golfer: golfer, label: "#{group_number}#{letter.upcase}" }
    end
  end

  def add_golfer(golfer)
    return false if full?

    next_position = golfers.count + 1
    golfer.update!(group: self, position: next_position)
    true
  end

  def remove_golfer(golfer)
    golfer.update!(group: nil, position: nil)
    reorder_positions
  end

  private

  def reorder_positions
    golfers.order(:position).each_with_index do |golfer, index|
      golfer.update_column(:position, index + 1)
    end
  end
end
