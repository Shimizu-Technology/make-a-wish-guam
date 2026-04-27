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

  test "create_tournament persists teams_per_start_position in config" do
    organization = organizations(:org_one)

    post "/api/v1/admin/organizations/#{organization.slug}/tournaments", params: {
      tournament: {
        name: "Configured Start Capacity Tournament",
        year: 2027,
        status: "draft",
        teams_per_start_position: 2
      }
    }, headers: auth_headers

    assert_response :created

    tournament = Tournament.order(:created_at).last
    assert_equal 2, tournament.config["teams_per_start_position"]
  end

  test "create_tournament persists start_positions_per_hole in config" do
    organization = organizations(:org_one)

    post "/api/v1/admin/organizations/#{organization.slug}/tournaments", params: {
      tournament: {
        name: "Configured Pairings Tournament",
        year: 2027,
        status: "draft",
        start_positions_per_hole: 2
      }
    }, headers: auth_headers

    assert_response :created

    tournament = Tournament.order(:created_at).last
    assert_equal 2, tournament.config["start_positions_per_hole"]
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

  test "cancel_golfer removes the team from its group before cancelling" do
    organization = organizations(:org_one)
    tournament = tournaments(:tournament_one)
    group = tournament.groups.create!(
      group_number: 99,
      starting_course_key: "course-1",
      hole_number: 9
    )
    golfer = tournament.golfers.create!(
      name: "Cancelable Team",
      email: "cancelable-team@example.com",
      phone: "671-555-0199",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      partner_name: "Partner Player",
      group: group,
      position: 1
    )

    post "/api/v1/admin/organizations/#{organization.slug}/tournaments/#{tournament.slug}/golfers/#{golfer.id}/cancel",
         headers: auth_headers,
         as: :json

    assert_response :success
    golfer.reload
    assert_equal "cancelled", golfer.registration_status
    assert_nil golfer.group_id
    assert_nil golfer.position

    get "/api/v1/groups", params: { tournament_id: tournament.id }, headers: auth_headers
    assert_response :success

    json = JSON.parse(response.body)
    refute json.any? { |entry| entry["id"] == group.id }
  end

  test "stripe refund failure leaves the golfer assigned to the original group" do
    organization = organizations(:org_one)
    tournament = tournaments(:tournament_one)
    group = tournament.groups.create!(
      group_number: 100,
      starting_course_key: "course-1",
      hole_number: 10
    )
    golfer = tournament.golfers.create!(
      name: "Stripe Refund Failure",
      email: "stripe-refund-failure@example.com",
      phone: "671-555-0188",
      payment_type: "stripe",
      payment_status: "paid",
      stripe_payment_intent_id: "pi_refund_failure_123",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current,
      team_category: "Male",
      group: group,
      position: 1
    )
    Setting.instance.update!(stripe_secret_key: "sk_test_refund_failure")

    refund_singleton = class << Stripe::Refund; self; end
    refund_singleton.send(:alias_method, :__original_create_for_test, :create)
    refund_singleton.send(:define_method, :create) { |*| raise Stripe::StripeError, "boom" }

    begin
      post "/api/v1/admin/organizations/#{organization.slug}/tournaments/#{tournament.slug}/golfers/#{golfer.id}/refund",
           headers: auth_headers,
           as: :json
    ensure
      refund_singleton.send(:alias_method, :create, :__original_create_for_test)
      refund_singleton.send(:remove_method, :__original_create_for_test)
    end

    assert_response :unprocessable_entity
    golfer.reload
    assert_equal "confirmed", golfer.registration_status
    assert_equal group.id, golfer.group_id
    assert_equal 1, golfer.position
    assert_equal "paid", golfer.payment_status
  end
end
