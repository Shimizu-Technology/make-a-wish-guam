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

  test "create_tournament rejects course config keys that collide with generated defaults" do
    organization = organizations(:org_one)

    assert_no_difference "Tournament.count" do
      post "/api/v1/admin/organizations/#{organization.slug}/tournaments", params: {
        tournament: {
          name: "Generated Key Collision Tournament",
          year: 2027,
          status: "draft",
          course_configs: [
            { name: "Hibiscus", hole_count: 9 },
            { key: "course-1", name: "Bouganvillea", hole_count: 9 }
          ]
        }
      }, headers: auth_headers, as: :json
    end

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_equal "Config Course configuration keys must be unique", json["error"]
  end

  test "public tournaments endpoint excludes non-public tournaments" do
    organization = organizations(:org_one)
    hidden_tournament = organization.tournaments.create!(
      name: "Hidden Tournament",
      slug: "hidden-tournament-2026",
      year: 2026,
      status: "open",
      registration_open: true,
      public_listed: false
    )

    get "/api/v1/organizations/#{organization.slug}/tournaments"

    assert_response :success

    json = JSON.parse(response.body)
    returned_slugs = json.map { |tournament| tournament.fetch("slug") }

    assert_includes returned_slugs, tournaments(:tournament_one).slug
    assert_not_includes returned_slugs, hidden_tournament.slug
  end

  test "public tournament endpoint returns not found for non-public tournaments" do
    organization = organizations(:org_one)
    hidden_tournament = organization.tournaments.create!(
      name: "Private Tournament",
      slug: "private-tournament-2026",
      year: 2026,
      status: "open",
      registration_open: true,
      public_listed: false
    )

    get "/api/v1/organizations/#{organization.slug}/tournaments/#{hidden_tournament.slug}"

    assert_response :not_found
  end

  test "create_golfer allows duplicate captain email for admin registrations" do
    organization = organizations(:org_one)
    tournament = tournaments(:tournament_one)

    tournament.golfers.create!(
      name: "Existing Team Captain",
      email: "poc@example.com",
      phone: "671-555-0101",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      registration_source: "admin",
      waiver_accepted_at: Time.current,
      team_category: "Male"
    )

    assert_difference "tournament.golfers.count", 1 do
      post "/api/v1/admin/organizations/#{organization.slug}/tournaments/#{tournament.slug}/golfers",
        params: {
          golfer: {
            name: "Second Team Captain",
            email: "poc@example.com",
            phone: "671-555-0102",
            partner_name: "Partner Two",
            registration_status: "confirmed",
            registration_source: "admin",
            payment_type: "pay_on_day",
            payment_status: "unpaid",
            payment_method: "check",
            waiver_accepted_at: Time.current.iso8601,
            team_category: "Male"
          }
        },
        headers: auth_headers,
        as: :json
    end

    assert_response :created
  end
end
