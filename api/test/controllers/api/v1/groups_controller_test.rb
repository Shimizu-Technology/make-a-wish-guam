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

  test "add_golfer persists assignment when golfer has a blank category" do
    group = groups(:group_three)
    group.golfers.destroy_all
    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(team_category: nil, updated_at: Time.current)

    post add_golfer_api_v1_group_url(group), params: { golfer_id: golfer.id }, headers: auth_headers

    assert_response :success
    golfer.reload
    assert_equal group.id, golfer.group_id
    assert_equal 1, golfer.position
  end

  test "add_golfer response includes the newly assigned team immediately" do
    group = groups(:group_three)
    group.golfers.destroy_all
    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(partner_name: "Fresh Partner", updated_at: Time.current)

    post add_golfer_api_v1_group_url(group), params: { golfer_id: golfer.id }, headers: auth_headers

    assert_response :success

    payload = JSON.parse(response.body)
    assert_equal group.id, payload["id"]
    assert_equal 1, payload["golfers"].length
    assert_equal golfer.id, payload["golfers"].first["id"]
    assert_equal 2, payload["player_count"]
    assert_equal false, payload["is_full"]
  end

  test "merge_into merges a waiting team into the specified pairing" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    target_group = groups(:group_one)
    golfers(:confirmed_paid).update_columns(partner_name: "Target Partner", updated_at: Time.current)
    golfers(:confirmed_checked_in).destroy!

    source_group = groups(:group_three)
    source_team = golfers(:confirmed_unpaid)
    source_team.update_columns(group_id: source_group.id, position: 1, partner_name: "Source Partner", updated_at: Time.current)

    assert_difference "Group.count", -1 do
      post merge_into_api_v1_group_url(source_group), params: {
        target_group_id: target_group.id
      }, headers: auth_headers
    end

    assert_response :success

    payload = JSON.parse(response.body)
    assert_equal source_group.id, payload["removed_group_id"]
    assert_equal target_group.id, payload["id"]
    assert_equal 2, payload["golfers"].length
    assert_equal target_group.id, source_team.reload.group_id
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

    payload = JSON.parse(response.body)
    assert_equal created_group.id, payload["id"]
    assert_equal 1, payload["golfers"].length
    assert_equal golfer.id, payload["golfers"].first["id"]
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

  test "place_golfer with new_pairing mode creates a fresh pairing even when another pairing has room" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    open_pairing = groups(:group_three)
    open_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    tournament.golfers.create!(
      group: open_pairing,
      name: "Open Pairing Team 1",
      partner_name: "Open Pairing Team 1 Partner",
      email: "open-pairing-new-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0312",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(partner_name: "Second Pairing Partner", updated_at: Time.current)

    assert_difference "Group.count", 1 do
      post place_golfer_api_v1_groups_url, params: {
        tournament_id: tournament.id,
        golfer_id: golfer.id,
        starting_course_key: "course-1",
        hole_number: 9,
        placement_mode: "new_pairing"
      }, headers: auth_headers
    end

    assert_response :created

    golfer.reload
    refute_equal open_pairing.id, golfer.group_id
    assert_equal "9B", Group.find(golfer.group_id).starting_position_label
  end

  test "place_golfer fills an existing open pairing before creating a new one" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    open_pairing = groups(:group_three)
    open_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    tournament.golfers.create!(
      group: open_pairing,
      name: "Open Pairing Team 1",
      partner_name: "Open Pairing Team 1 Partner",
      email: "open-pairing-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0310",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 1
    )

    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(partner_name: "Second Team Partner", updated_at: Time.current)

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
    assert_equal open_pairing.id, golfer.group_id
    assert_equal 2, golfer.position
  end

  test "place_golfer rejects creating a third pairing on a hole when only two are allowed" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    first_pairing = groups(:group_one)
    first_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    golfers(:confirmed_paid).update_columns(partner_name: "First Pairing Partner 1", updated_at: Time.current)
    golfers(:confirmed_checked_in).update_columns(partner_name: "First Pairing Partner 2", updated_at: Time.current)

    second_pairing = groups(:group_two)
    second_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    golfers(:stripe_golfer).update_columns(partner_name: "Second Pairing Partner 1", updated_at: Time.current)
    tournament.golfers.create!(
      group: second_pairing,
      name: "Second Pairing Team 2",
      partner_name: "Second Pairing Team 2 Partner",
      email: "second-pairing-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0311",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 2
    )

    golfer = golfers(:confirmed_unpaid)
    golfer.update_columns(partner_name: "Overflow Partner", updated_at: Time.current)

    assert_no_difference "Group.count" do
      post place_golfer_api_v1_groups_url, params: {
        tournament_id: tournament.id,
        golfer_id: golfer.id,
        starting_course_key: "course-1",
        hole_number: 9
      }, headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert_equal "Hole 9 already has 2 pairings", JSON.parse(response.body)["error"]
    assert_nil golfer.reload.group_id
  end

  test "set_hole merges a waiting team into an open pairing on the target hole" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    target_group = groups(:group_one)
    target_group.update!(starting_course_key: "course-1", hole_number: 9)
    golfers(:confirmed_paid).update_columns(partner_name: "Target Partner", updated_at: Time.current)
    golfers(:confirmed_checked_in).destroy!

    source_group = groups(:group_three)
    source_team = golfers(:confirmed_unpaid)
    source_team.update_columns(group_id: source_group.id, position: 1, partner_name: "Source Partner", updated_at: Time.current)

    assert_difference "Group.count", -1 do
      post set_hole_api_v1_group_url(source_group), params: {
        starting_course_key: "course-1",
        hole_number: 9
      }, headers: auth_headers
    end

    assert_response :success

    payload = JSON.parse(response.body)
    assert_equal source_group.id, payload["removed_group_id"]
    assert_equal target_group.id, payload["id"]
    assert_equal 2, payload["golfers"].length
    assert_equal target_group.id, source_team.reload.group_id
    refute Group.exists?(source_group.id)
  end

  test "set_hole rejects moving a waiting team onto a full hole when pairing limit is reached" do
    tournament = tournaments(:tournament_one)
    tournament.update!(
      team_size: 2,
      config: (tournament.config || {}).merge(
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2
      )
    )

    first_pairing = groups(:group_one)
    first_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    golfers(:confirmed_paid).update_columns(partner_name: "First Pairing Partner 1", updated_at: Time.current)
    golfers(:confirmed_checked_in).update_columns(partner_name: "First Pairing Partner 2", updated_at: Time.current)

    second_pairing = groups(:group_two)
    second_pairing.update!(starting_course_key: "course-1", hole_number: 9)
    golfers(:stripe_golfer).update_columns(partner_name: "Second Pairing Partner 1", updated_at: Time.current)
    tournament.golfers.create!(
      group: second_pairing,
      name: "Second Pairing Team 2",
      partner_name: "Second Pairing Team 2 Partner",
      email: "set-hole-second-pairing-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0313",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      position: 2
    )

    source_group = groups(:group_three)
    source_team = golfers(:confirmed_unpaid)
    source_team.update_columns(group_id: source_group.id, position: 1, partner_name: "Overflow Partner", updated_at: Time.current)

    assert_no_difference "Group.count" do
      post set_hole_api_v1_group_url(source_group), params: {
        starting_course_key: "course-1",
        hole_number: 9
      }, headers: auth_headers
    end

    assert_response :unprocessable_entity
    assert_equal "Hole 9 already has 2 pairings", JSON.parse(response.body)["error"]
    assert_equal source_group.id, source_team.reload.group_id
    refute_equal "course-1", source_group.reload.starting_course_key
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

  test "auto_assign includes pending golfers created by admins" do
    tournament = tournaments(:tournament_one)
    pending_golfer = tournament.golfers.create!(
      name: "Pending Admin Golfer",
      email: "pending-admin-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-0111",
      payment_type: "stripe",
      payment_status: "unpaid",
      registration_status: "pending",
      registration_source: "admin",
      waiver_accepted_at: Time.current,
      team_category: "Male"
    )

    post auto_assign_api_v1_groups_url, params: {
      tournament_id: tournament.id
    }, headers: auth_headers

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 2, json["assigned_count"]
    assert_equal 0, json["failed_count"]

    pending_golfer.reload
    assert_not_nil pending_golfer.group_id
    assert_operator pending_golfer.position, :>=, 1
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
