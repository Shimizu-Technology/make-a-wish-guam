require "test_helper"

class Api::V1::TournamentsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
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
end
