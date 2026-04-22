require "test_helper"

class GroupTest < ActiveSupport::TestCase
  # ==================
  # Validations
  # ==================

  test "should be valid with tournament and group_number" do
    group = Group.new(
      tournament: tournaments(:tournament_one),
      group_number: 99
    )
    assert group.valid?
  end

  test "should require tournament" do
    group = Group.new(tournament: nil, group_number: 99)
    assert_not group.valid?
    assert_includes group.errors[:tournament], "must exist"
  end

  test "should require group_number" do
    group = Group.new(
      tournament: tournaments(:tournament_one),
      group_number: nil
    )
    assert_not group.valid?
    assert_includes group.errors[:group_number], "can't be blank"
  end

  test "should require unique group_number within tournament" do
    existing = groups(:group_one)
    group = Group.new(
      tournament: existing.tournament,
      group_number: existing.group_number
    )
    assert_not group.valid?
    assert_includes group.errors[:group_number], "has already been taken"
  end

  test "should allow same group_number in different tournaments" do
    existing = groups(:group_one)
    other_tournament = tournaments(:tournament_archived)
    
    group = Group.new(
      tournament: other_tournament,
      group_number: existing.group_number
    )
    assert group.valid?
  end

  test "hole_number is optional" do
    group = Group.new(
      tournament: tournaments(:tournament_one),
      group_number: 100,
      hole_number: nil
    )
    assert group.valid?
  end

  # ==================
  # Associations
  # ==================

  test "belongs to tournament" do
    group = groups(:group_one)
    assert_respond_to group, :tournament
    assert_instance_of Tournament, group.tournament
  end

  test "has many golfers" do
    group = groups(:group_one)
    assert_respond_to group, :golfers
    assert group.golfers.count >= 0
  end

  test "golfers are ordered by position" do
    group = groups(:group_one)
    positions = group.golfers.order(:position).pluck(:position).compact
    assert_equal positions.sort, positions
  end

  # ==================
  # Scopes
  # ==================

  test "with_golfers scope only returns groups that still have golfers loaded and ordered" do
    groups_list = Group.with_golfers
    numbers = groups_list.pluck(:group_number)
    assert_equal numbers.sort, numbers
    assert groups_list.all? { |group| group.golfers.any? }
    assert groups_list.all? { |group| group.association(:golfers).loaded? }
    assert groups_list.all? { |group| group.association(:tournament).loaded? }
  end

  test "for_tournament scope returns groups for specific tournament" do
    tournament = tournaments(:tournament_one)
    groups = Group.for_tournament(tournament.id)
    assert groups.all? { |g| g.tournament_id == tournament.id }
  end

  # ==================
  # Instance Methods
  # ==================

  test "full? returns false when under capacity" do
    group = groups(:group_three)
    group.golfers.destroy_all
    assert_not group.full?
  end

  test "MAX_GOLFERS constant is 4" do
    assert_equal 4, Group::MAX_GOLFERS
  end

  test "assigns default course key for legacy single-course holes" do
    group = Group.new(
      tournament: tournaments(:tournament_one),
      group_number: 101,
      hole_number: 9
    )

    assert group.valid?
    assert_equal "course-1", group.starting_course_key
    assert_equal "9A", group.starting_position_label
  end

  test "supports multi-course starting labels" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    )

    group = Group.new(
      tournament: tournament,
      group_number: 102,
      starting_course_key: "hibiscus",
      hole_number: 1
    )

    assert group.valid?
    assert_equal "Hibiscus 1A", group.starting_position_label
    assert_equal "Hibiscus Hole 1", group.starting_hole_description
  end

  test "starting_position_label ignores empty groups at the same start" do
    tournament = tournaments(:tournament_one)
    empty_group = tournament.groups.create!(
      group_number: 4,
      starting_course_key: "course-1",
      hole_number: 1
    )
    filled_group = tournament.groups.create!(
      group_number: 5,
      starting_course_key: "course-1",
      hole_number: 1
    )
    tournament.golfers.create!(
      group: filled_group,
      name: "Filled Start Golfer",
      email: "filled-start-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0188",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    assert empty_group.empty_slot?
    assert_equal "1B", filled_group.starting_position_label
  end

  test "rejects hole numbers outside configured course range" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 }
        ]
      }
    )

    group = Group.new(
      tournament: tournament,
      group_number: 103,
      starting_course_key: "hibiscus",
      hole_number: 10
    )

    assert_not group.valid?
    assert_includes group.errors[:hole_number], "must be between 1 and 9 for Hibiscus"
  end

  test "rejects invalid course hole ranges instead of silently skipping validation" do
    tournament = tournaments(:tournament_one)
    group = Group.new(
      tournament: tournament,
      group_number: 104,
      starting_course_key: "course-1",
      hole_number: 1
    )

    tournament.define_singleton_method(:hole_count_for_course) { |_course_key| 0 }

    assert_not group.valid?
    assert_includes group.errors[:starting_course_key], "is not configured for a valid hole range"
  end

  test "add_golfer assigns golfer to group" do
    group = groups(:group_three)
    group.golfers.destroy_all
    golfer = Golfer.create!(
      tournament: group.tournament,
      name: "Valid Assigned Golfer",
      email: "assigned-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0101",
      payment_type: "pay_on_day",
      payment_status: "unpaid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male"
    )
    
    result = group.add_golfer(golfer)
    
    assert result
    golfer.reload
    assert_equal group.id, golfer.group_id
    assert_equal 1, golfer.position
  end

  test "add_golfer persists group assignment without re-running unrelated golfer validations" do
    group = groups(:group_three)
    group.golfers.destroy_all
    golfer = Golfer.create!(
      tournament: group.tournament,
      name: "Temporarily Invalid Golfer",
      email: "invalid-add-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0102",
      payment_type: "pay_on_day",
      payment_status: "unpaid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male"
    )
    golfer.update_columns(name: nil, updated_at: Time.current)

    result = group.add_golfer(golfer)

    assert result
    golfer.reload
    assert_equal group.id, golfer.group_id
    assert_equal 1, golfer.position
  end

  test "remove_golfer unassigns golfer from group" do
    group = groups(:group_one)
    golfer = Golfer.create!(
      tournament: group.tournament,
      group: group,
      name: "Valid Removed Golfer",
      email: "removed-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0103",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: group.golfers.maximum(:position).to_i + 1
    )
    
    group.remove_golfer(golfer)
    golfer.reload
    
    assert_nil golfer.group_id
    assert_nil golfer.position
  end

  test "remove_golfer clears assignment without re-running unrelated golfer validations" do
    group = groups(:group_one)
    golfer = Golfer.create!(
      tournament: group.tournament,
      group: group,
      name: "Temporarily Invalid Removal Golfer",
      email: "invalid-remove-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0104",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: group.golfers.maximum(:position).to_i + 1
    )
    golfer.update_columns(name: nil, updated_at: Time.current)

    result = group.remove_golfer(golfer)

    assert result
    golfer.reload
    assert_nil golfer.group_id
    assert_nil golfer.position
  end
end
