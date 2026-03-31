require "test_helper"

class RaffleSponsorsAccessControlTest < ActionDispatch::IntegrationTest
  setup do
    @org_a = organizations(:org_one)
    @org_a_tournament = tournaments(:tournament_one)

    @org_a_admin = users(:user_one)
    @org_a_admin.update!(clerk_id: "test_clerk_#{@org_a_admin.id}") if @org_a_admin.clerk_id.blank?
    OrganizationMembership.find_or_create_by!(user: @org_a_admin, organization: @org_a) do |membership|
      membership.role = "admin"
    end

    @org_b = Organization.create!(
      name: "Organization B",
      slug: "org-b-#{SecureRandom.hex(4)}",
      subscription_status: "active",
      primary_color: "#0f766e"
    )

    @org_b_tournament = @org_b.tournaments.create!(
      name: "Org B Tournament",
      slug: "org-b-tournament-#{SecureRandom.hex(4)}",
      year: 2026,
      edition: "1st",
      status: "open",
      event_date: "2026-02-16",
      registration_open: true,
      max_capacity: 120,
      entry_fee: 15000
    )

    @headers = { "Authorization" => "Bearer test_token_#{@org_a_admin.id}" }
  end

  test "org A admin cannot create raffle prize for org B tournament" do
    post "/api/v1/tournaments/#{@org_b_tournament.id}/raffle/prizes",
         params: {
           prize: {
             name: "Cross-Org Prize",
             tier: "standard",
             value_cents: 5000
           }
         },
         headers: @headers

    assert_response :forbidden
  end

  test "org A admin cannot create sponsor for org B tournament" do
    post "/api/v1/tournaments/#{@org_b_tournament.id}/sponsors",
         params: {
           sponsor: {
             name: "Cross-Org Sponsor",
             tier: "gold",
             position: 0
           }
         },
         headers: @headers

    assert_response :forbidden
  end

  test "org A admin can create sponsor for org A tournament" do
    post "/api/v1/tournaments/#{@org_a_tournament.id}/sponsors",
         params: {
           sponsor: {
             name: "Local Sponsor",
             tier: "gold",
             position: 0
           }
         },
         headers: @headers

    assert_response :created
  end
end
