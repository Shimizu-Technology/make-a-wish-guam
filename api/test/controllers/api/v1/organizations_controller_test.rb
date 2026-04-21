require "test_helper"

class Api::V1::OrganizationsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  test "create_tournament rejects an explicitly empty course config list" do
    organization = organizations(:org_one)

    assert_no_difference "Tournament.count" do
      post "/api/v1/admin/organizations/#{organization.slug}/tournaments", params: {
        tournament: {
          name: "Org Empty Course Config Tournament",
          year: 2027,
          status: "draft",
          course_configs: []
        }
      }, headers: auth_headers
    end

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_equal "Config At least one course must be configured", json["error"]
  end

  test "create_tournament rejects duplicate explicit course config keys" do
    organization = organizations(:org_one)

    assert_no_difference "Tournament.count" do
      post "/api/v1/admin/organizations/#{organization.slug}/tournaments", params: {
        tournament: {
          name: "Duplicate Course Key Tournament",
          year: 2027,
          status: "draft",
          course_configs: [
            { key: "hibiscus", name: "Hibiscus Front", hole_count: 9 },
            { key: "hibiscus", name: "Hibiscus Back", hole_count: 9 }
          ]
        }
      }, headers: auth_headers
    end

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_equal "Config Course configuration keys must be unique", json["error"]
  end
end
