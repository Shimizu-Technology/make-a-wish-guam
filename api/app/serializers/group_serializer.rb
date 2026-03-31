class GroupSerializer < ActiveModel::Serializer
  attributes :id, :tournament_id, :group_number, :hole_number, :created_at, :updated_at,
             :golfer_count, :is_full, :hole_position_label

  has_many :golfers

  def golfer_count
    object.golfers.count
  end

  def is_full
    object.full?
  end

  # Hole-based label for the group (e.g., "7A" for first foursome at Hole 7)
  # Always includes a letter suffix for consistency (even if only one foursome at that hole)
  def hole_position_label
    return "Unassigned" unless object.hole_number

    # Get all groups at this hole, sorted by group_number for consistent ordering
    groups_at_hole = Group.where(
      tournament_id: object.tournament_id,
      hole_number: object.hole_number
    ).order(:group_number)

    # Find this group's index among all groups at this hole
    group_ids = groups_at_hole.pluck(:id)
    position_index = group_ids.index(object.id)
    
    # Always add letter suffix for consistency
    position_letter = ('A'..'Z').to_a[position_index] || 'X'
    "#{object.hole_number}#{position_letter}"
  end
end

