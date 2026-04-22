require "test_helper"

class Api::V1::GroupsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/groups
  # ==================

  test "index returns all groups" do
    get api_v1_groups_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length > 0
  end

  test "index returns stable labels for multiple groups on the same start" do
    tournament = tournaments(:tournament_one)
    second_group = tournament.groups.create!(
      group_number: 4,
      starting_course_key: "course-1",
      hole_number: 1
    )
    tournament.golfers.create!(
      group: second_group,
      name: "Second Start Golfer",
      email: "second-start-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0199",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    get api_v1_groups_url, headers: auth_headers
    assert_response :success

    json = JSON.parse(response.body)
    first = json.find { |group| group["id"] == groups(:group_one).id }
    second = json.find { |group| group["id"] == second_group.id }

    assert_equal "1A", first["starting_position_label"]
    assert_equal "1B", second["starting_position_label"]
  end

  test "index excludes empty leftover groups without deleting them" do
    tournament = tournaments(:tournament_one)
    empty_group = tournament.groups.create!(
      group_number: 4,
      starting_course_key: "course-1",
      hole_number: 1
    )

    assert_no_difference "Group.count" do
      get api_v1_groups_url, headers: auth_headers
    end

    assert_response :success
    assert Group.exists?(empty_group.id)

    json = JSON.parse(response.body)
    refute json.any? { |group| group["id"] == empty_group.id }
  end

  test "index requires authentication" do
    get api_v1_groups_url
    assert_response :unauthorized
  end

  # ==================
  # GET /api/v1/groups/:id
  # ==================

  test "show returns group with golfers" do
    group = groups(:group_one)
    get api_v1_group_url(group), headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_equal group.group_number, json["group_number"]
    assert json.key?("golfers")
  end

  test "show returns 404 for non-existent group" do
    get api_v1_group_url(id: 999999), headers: auth_headers
    assert_response :not_found
  end

  # ==================
  # POST /api/v1/groups
  # ==================

  test "create adds new group with auto-assigned number" do
    # Controller auto-assigns the next group number
    expected_number = Group.maximum(:group_number).to_i + 1
    
    assert_difference "Group.count", 1 do
      post api_v1_groups_url, params: {
        starting_course_key: "course-1",
        hole_number: 10
      }, headers: auth_headers
    end
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal expected_number, json["group_number"]
    assert_equal "course-1", json["starting_course_key"]
    assert_equal 10, json["hole_number"]
  end

  test "create assigns sequential group numbers" do
    initial_max = Group.maximum(:group_number).to_i
    
    post api_v1_groups_url, params: { hole_number: nil }, headers: auth_headers
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal initial_max + 1, json["group_number"]
  end

  # ==================
  # PATCH /api/v1/groups/:id
  # ==================

  test "update modifies group" do
    group = groups(:group_three)
    
    patch api_v1_group_url(group), params: {
      group: { starting_course_key: "course-1", hole_number: 15 }
    }, headers: auth_headers
    
    assert_response :success
    group.reload
    assert_equal "course-1", group.starting_course_key
    assert_equal 15, group.hole_number
  end

  test "set_hole clears an assigned starting position" do
    group = groups(:group_one)

    post set_hole_api_v1_group_url(group), params: {
      starting_course_key: nil,
      hole_number: nil
    }, headers: auth_headers

    assert_response :success
    group.reload
    assert_nil group.starting_course_key
    assert_nil group.hole_number
  end

  test "set_hole deletes an empty slot when clearing its starting position" do
    group = groups(:group_three)
    group.update!(starting_course_key: "course-1", hole_number: 7)

    assert_difference "Group.count", -1 do
      post set_hole_api_v1_group_url(group), params: {
        starting_course_key: nil,
        hole_number: nil
      }, headers: auth_headers
    end

    assert_response :success
    assert_equal group.id, JSON.parse(response.body)["removed_group_id"]
  end

  test "set_hole supports configured multi-course assignments" do
    group = groups(:group_three)
    tournament = group.tournament
    tournament.update!(
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    )

    post set_hole_api_v1_group_url(group), params: {
      starting_course_key: "hibiscus",
      hole_number: 3
    }, headers: auth_headers

    assert_response :success
    group.reload
    assert_equal "hibiscus", group.starting_course_key
    assert_equal 3, group.hole_number
  end

  test "set_hole logs automatic label compaction for other teams at the same start" do
    tournament = tournaments(:tournament_one)
    trailing_group = tournament.groups.create!(
      group_number: 4,
      starting_course_key: "course-1",
      hole_number: 1
    )
    trailing_golfer = tournament.golfers.create!(
      group: trailing_group,
      name: "Trailing Golfer",
      email: "trailing-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0200",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    post set_hole_api_v1_group_url(groups(:group_one)), params: {
      starting_course_key: "course-1",
      hole_number: 2
    }, headers: auth_headers

    assert_response :success

    trailing_golfer.reload
    log = ActivityLog.where(target_type: "Golfer", target_id: trailing_golfer.id, action: "group_updated").order(:created_at).last
    assert_equal "Starting position adjusted to 1A (was 1B)", log.details
    assert_equal "1A", log.metadata["starting_position_label"]
    assert_equal "1B", log.metadata["previous_label"]
    assert_equal true, log.metadata["auto_adjusted"]
  end

  test "set_hole rejects zero as an invalid hole number" do
    group = groups(:group_three)

    post set_hole_api_v1_group_url(group), params: {
      starting_course_key: "course-1",
      hole_number: 0
    }, headers: auth_headers

    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["error"], "Hole number must be between 1 and 18"
    group.reload
    assert_nil group.hole_number
  end

  test "add_golfer persists assignment even when golfer has unrelated invalid registration fields" do
    group = groups(:group_three)
    group.golfers.destroy_all
    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(name: nil, updated_at: Time.current)

    post add_golfer_api_v1_group_url(group), params: { golfer_id: golfer.id }, headers: auth_headers

    assert_response :success
    golfer.reload
    assert_equal group.id, golfer.group_id
    assert_equal 1, golfer.position
  end

  test "place_golfer creates a started group and returns consistent metadata" do
    tournament = tournaments(:tournament_one)
    golfer = golfers(:confirmed_unpaid)

    assert_difference "Group.count", 1 do
      post place_golfer_api_v1_groups_url, params: {
        tournament_id: tournament.id,
        golfer_id: golfer.id,
        starting_course_key: "course-1",
        hole_number: 9
      }, headers: auth_headers
    end

    assert_response :created

    golfer.reload
    assert_not_nil golfer.group_id
    assert_equal 1, golfer.position

    created_group = Group.find(golfer.group_id)
    assert_equal "course-1", created_group.starting_course_key
    assert_equal 9, created_group.hole_number

    log = ActivityLog.where(action: "golfer_assigned_to_group", target_type: "Golfer", target_id: golfer.id).order(:created_at).last
    assert_equal created_group.id, log.metadata["group_id"]
    assert_equal created_group.group_number, log.metadata["group_number"]
    assert_equal created_group.starting_position_label, log.metadata["starting_position_label"]
    assert_equal created_group.hole_position_label, log.metadata["hole_label"]
  end

  test "place_golfer persists assignment when golfer has a blank category" do
    tournament = tournaments(:tournament_one)
    golfer = golfers(:confirmed_unpaid)

    golfer.update_columns(
      team_category: nil,
      updated_at: Time.current
    )

    assert_difference "Group.count", 1 do
      post place_golfer_api_v1_groups_url, params: {
        tournament_id: tournament.id,
        golfer_id: golfer.id,
        starting_course_key: "course-1",
        hole_number: 10
      }, headers: auth_headers
    end

    assert_response :created

    golfer.reload
    assert_not_nil golfer.group_id
    assert_equal 1, golfer.position
  end

  test "place_golfer reuses the earliest empty slot on a start" do
    tournament = tournaments(:tournament_one)
    reusable_group = groups(:group_three)
    reusable_group.update!(starting_course_key: "course-1", hole_number: 9)
    golfer = golfers(:confirmed_unpaid)

    assert_no_difference "Group.count" do
      post place_golfer_api_v1_groups_url, params: {
        tournament_id: tournament.id,
        golfer_id: golfer.id,
        starting_course_key: "course-1",
        hole_number: 9
      }, headers: auth_headers
    end

    assert_response :created
    golfer.reload
    assert_equal reusable_group.id, golfer.group_id
    assert_equal 1, golfer.position
  end

  test "remove_golfer clears assignment even when golfer has unrelated invalid registration fields" do
    golfer = golfers(:confirmed_paid)
    group = golfer.group
    golfer.update_columns(name: nil, updated_at: Time.current)

    post remove_golfer_api_v1_group_url(group), params: { golfer_id: golfer.id }, headers: auth_headers

    assert_response :success
    golfer.reload
    assert_nil golfer.group_id
    assert_nil golfer.position
  end

  test "remove_golfer deletes an emptied slot so later groups compact forward" do
    group = groups(:group_two)
    golfer = golfers(:stripe_golfer)
    later_group = group.tournament.groups.create!(
      group_number: 4,
      starting_course_key: "course-1",
      hole_number: group.hole_number
    )
    later_golfer = group.tournament.golfers.create!(
      group: later_group,
      name: "Later Slot Golfer",
      email: "later-slot-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0400",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    post remove_golfer_api_v1_group_url(group), params: { golfer_id: golfer.id }, headers: auth_headers

    assert_response :success
    refute Group.exists?(group.id)

    later_golfer.reload
    assert_equal later_group.id, later_golfer.group_id
    assert_equal "5A", later_group.reload.starting_position_label
    assert_equal group.id, JSON.parse(response.body)["removed_group_id"]
  end

  test "auto_assign places golfers even when unrelated registration validations would fail" do
    tournament = tournaments(:tournament_one)
    tournament.update_column(:team_size, 1)
    groups(:group_three).golfers.create!(
      tournament: tournament,
      name: "Existing Group Three Player",
      company: "Test Corp",
      address: "123 Test St",
      phone: "671-555-0100",
      email: "group-three@test.com",
      payment_type: "pay_on_day",
      payment_status: "paid",
      waiver_accepted_at: Time.current,
      registration_status: "confirmed",
      team_category: "Male",
      position: 1
    )

    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(name: nil, updated_at: Time.current)

    assert_difference "Group.count", 1 do
      post auto_assign_api_v1_groups_url, params: {
        tournament_id: tournament.id
      }, headers: auth_headers
    end

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 1, json["assigned_count"]
    assert_equal 0, json["failed_count"]

    golfer.reload
    assert_not_nil golfer.group_id
    assert_equal 1, golfer.position
  end

  # ==================
  # DELETE /api/v1/groups/:id
  # ==================

  test "destroy removes group" do
    group = groups(:group_three)
    group.golfers.update_all(group_id: nil)
    
    assert_difference "Group.count", -1 do
      delete api_v1_group_url(group), headers: auth_headers
    end
    assert_response :no_content
  end
end
