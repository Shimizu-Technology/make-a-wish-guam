class GroupSerializer < ActiveModel::Serializer
  attributes :id, :tournament_id, :group_number, :starting_course_key, :starting_course_name,
             :hole_number, :created_at, :updated_at, :golfer_count, :is_full,
             :starting_position_label, :hole_position_label, :starting_hole_description,
             :max_golfers, :player_count

  has_many :golfers

  def golfer_count
    object.golfers.size
  end

  def player_count
    object.player_count
  end

  def is_full
    object.full?
  end

  def max_golfers
    object.max_golfers
  end

  def starting_course_name
    object.starting_course_name
  end

  def starting_position_label
    object.starting_position_label
  end

  def hole_position_label
    object.hole_position_label
  end

  def starting_hole_description
    object.starting_hole_description
  end
end
