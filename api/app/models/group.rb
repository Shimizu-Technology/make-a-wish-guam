class Group < ApplicationRecord
  belongs_to :tournament
  has_many :golfers, dependent: :nullify
  has_many :scores, dependent: :destroy

  validates :group_number, presence: true, uniqueness: { scope: :tournament_id }
  validates :hole_number, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :tournament_id, presence: true
  validate :starting_position_is_consistent
  validate :starting_course_exists_in_tournament
  validate :hole_number_within_course_range

  before_validation :normalize_starting_position

  scope :with_golfers, -> { joins(:golfers).includes(:golfers, :tournament).distinct.order(:group_number) }
  scope :for_tournament, ->(tournament_id) { where(tournament_id: tournament_id) }
  scope :without_golfers, -> { left_outer_joins(:golfers).where(golfers: { id: nil }).distinct }

  MAX_GOLFERS_DEFAULT = 4
  MAX_GOLFERS = MAX_GOLFERS_DEFAULT

  def self.preload_position_letters(groups)
    groups.select(&:assigned_start?)
          .group_by { |group| [group.starting_course_key, group.hole_number] }
          .each_value do |groups_at_start|
      groups_at_start.sort_by!(&:group_number)
      groups_at_start.each_with_index do |group, index|
        group.send(:precomputed_position_letter=, ("A".."Z").to_a[index] || "X")
      end
    end

    groups
  end

  def self.reusable_slot_for(tournament:, course_key:, hole_number:)
    for_tournament(tournament.id)
      .where(starting_course_key: course_key, hole_number: hole_number)
      .without_golfers
      .order(:group_number)
      .first
  end

  def max_golfers
    tournament&.team_size || MAX_GOLFERS_DEFAULT
  end

  def assigned_start?
    starting_course_key.present? && hole_number.present?
  end

  def starting_course_name
    return nil unless starting_course_key.present?

    tournament&.course_name_for(starting_course_key)
  end

  def starting_hole_description
    return nil unless assigned_start?

    tournament&.starting_hole_description(starting_course_key, hole_number)
  end

  def player_count
    if golfers.loaded?
      golfers.sum { |g| g.partner_name.present? ? 2 : 1 }
    else
      golfers.pick(Arel.sql("COUNT(*) + COUNT(NULLIF(partner_name, ''))")).to_i
    end
  end

  def full?
    player_count >= max_golfers
  end

  def can_add?(golfer)
    incoming = golfer.partner_name.present? ? 2 : 1
    player_count + incoming <= max_golfers
  end

  def starting_position_label
    return "Unassigned" unless assigned_start?

    prefix = tournament&.starting_position_prefix(starting_course_key)
    [prefix, "#{hole_number}#{position_letter}"].compact.join(" ")
  end

  alias_method :hole_position_label, :starting_position_label

  def golfer_labels
    golfers.order(:position).map.with_index do |golfer, index|
      letter = ("a".."d").to_a[index]
      { golfer: golfer, label: "#{group_number}#{letter.upcase}" }
    end
  end

  def add_golfer(golfer)
    return false unless can_add?(golfer)

    next_position =
      if golfers.loaded?
        golfers.map(&:position).compact.max.to_i + 1
      else
        golfers.maximum(:position).to_i + 1
      end

    golfer.assign_to_group(group: self, position: next_position)
  end

  def remove_golfer(golfer)
    return false unless golfer.clear_group_assignment

    reorder_positions
    true
  end

  def empty_slot?
    golfers.loaded? ? golfers.empty? : !golfers.exists?
  end

  private

  attr_writer :precomputed_position_letter

  def position_letter
    return @precomputed_position_letter if instance_variable_defined?(:@precomputed_position_letter)

    groups_at_start = Group.joins(:golfers).where(
      tournament_id: tournament_id,
      starting_course_key: starting_course_key,
      hole_number: hole_number
    ).distinct.order(:group_number).pluck(:id, :group_number)

    position_index = groups_at_start.index { |group_id, _group_number| group_id == id }
    position_index ||= groups_at_start.count { |_group_id, number| number < group_number }

    ("A".."Z").to_a[position_index] || "X"
  end

  def normalize_starting_position
    self.starting_course_key = starting_course_key.presence
    self.hole_number = hole_number.presence

    if hole_number.present? && starting_course_key.blank? && tournament.present?
      self.starting_course_key = tournament.default_course_key
    end

    self.hole_number = nil if starting_course_key.blank?
  end

  def starting_position_is_consistent
    return if starting_course_key.blank? && hole_number.blank?
    return if starting_course_key.present? && hole_number.present?

    errors.add(:base, "Starting course and hole number must both be provided")
  end

  def starting_course_exists_in_tournament
    return unless starting_course_key.present? && tournament.present?
    return if tournament.course_config_for(starting_course_key).present?

    errors.add(:starting_course_key, "is not configured for this event")
  end

  def hole_number_within_course_range
    return unless starting_course_key.present? && hole_number.present? && tournament.present?
    return if errors[:starting_course_key].present?

    max_holes = tournament.hole_count_for_course(starting_course_key)
    unless max_holes.positive?
      errors.add(:starting_course_key, "is not configured for a valid hole range")
      return
    end
    return if hole_number <= max_holes

    errors.add(:hole_number, "must be between 1 and #{max_holes} for #{starting_course_name}")
  end

  def reorder_positions
    golfers.order(:position).each_with_index do |golfer, index|
      golfer.update_column(:position, index + 1)
    end
  end
end
