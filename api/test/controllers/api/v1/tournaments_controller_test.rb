require "test_helper"

class Api::V1::TournamentsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  test "create persists total_holes from course configs" do
    post "/api/v1/admin/tournaments", params: {
      tournament: {
        organization_id: organizations(:org_one).id,
        name: "Configured Course Tournament",
        year: 2027,
        status: "draft",
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    }, headers: auth_headers

    assert_response :created

    tournament = Tournament.order(:created_at).last
    assert_equal 18, tournament.total_holes
  end

  test "update persists total_holes from course configs" do
    tournament = tournaments(:tournament_one)

    patch "/api/v1/tournaments/#{tournament.id}", params: {
      tournament: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    }, headers: auth_headers

    assert_response :success

    tournament.reload
    assert_equal 18, tournament.total_holes
  end

  test "create rejects an explicitly empty course config list" do
    assert_no_difference "Tournament.count" do
      post "/api/v1/admin/tournaments", params: {
        tournament: {
          organization_id: organizations(:org_one).id,
          name: "Empty Course Config Tournament",
          year: 2027,
          status: "draft",
          course_configs: []
        }
      }, headers: auth_headers
    end

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_includes json["errors"], "Config At least one course must be configured"
  end

  test "update rejects an explicitly empty course config list" do
    patch "/api/v1/tournaments/#{tournaments(:tournament_one).id}", params: {
      tournament: {
        course_configs: []
      }
    }, headers: auth_headers

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_includes json["errors"], "Config At least one course must be configured"
  end

  test "update rejects duplicate explicit course config keys" do
    patch "/api/v1/tournaments/#{tournaments(:tournament_one).id}", params: {
      tournament: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus Front", hole_count: 9 },
          { key: "hibiscus", name: "Hibiscus Back", hole_count: 9 }
        ]
      }
    }, headers: auth_headers

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_includes json["errors"], "Config Course configuration keys must be unique"
  end

  test "update rejects course config keys that collide with generated defaults" do
    patch "/api/v1/tournaments/#{tournaments(:tournament_one).id}", params: {
      tournament: {
        course_configs: [
          { name: "Hibiscus", hole_count: 9 },
          { key: "course-1", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    }, headers: auth_headers, as: :json

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_includes json["errors"], "Config Course configuration keys must be unique"
  end

  test "update persists teams_per_start_position in config" do
    tournament = tournaments(:tournament_one)

    patch "/api/v1/tournaments/#{tournament.id}", params: {
      tournament: {
        teams_per_start_position: 2
      }
    }, headers: auth_headers

    assert_response :success

    tournament.reload
    assert_equal 2, tournament.config["teams_per_start_position"]
  end

  test "update persists start_positions_per_hole in config" do
    tournament = tournaments(:tournament_one)

    patch "/api/v1/tournaments/#{tournament.id}", params: {
      tournament: {
        start_positions_per_hole: 2
      }
    }, headers: auth_headers

    assert_response :success

    tournament.reload
    assert_equal 2, tournament.config["start_positions_per_hole"]
  end
end
