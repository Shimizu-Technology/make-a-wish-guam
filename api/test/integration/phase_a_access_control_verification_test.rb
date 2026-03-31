require "test_helper"

class PhaseAAccessControlVerificationTest < ActionDispatch::IntegrationTest
  def setup
    super

    @org_a = Organization.create!(
      name: "Org A",
      slug: "org-a",
      subscription_status: "active"
    )
    @org_b = Organization.create!(
      name: "Org B",
      slug: "org-b",
      subscription_status: "active"
    )

    @org_a_admin = User.create!(
      email: "org-a-admin-#{SecureRandom.hex(4)}@example.com",
      role: "org_admin",
      clerk_id: "org_a_admin_#{SecureRandom.hex(4)}"
    )
    @org_b_admin = User.create!(
      email: "org-b-admin-#{SecureRandom.hex(4)}@example.com",
      role: "org_admin",
      clerk_id: "org_b_admin_#{SecureRandom.hex(4)}"
    )

    OrganizationMembership.create!(
      organization: @org_a,
      user: @org_a_admin,
      role: "admin"
    )
    OrganizationMembership.create!(
      organization: @org_b,
      user: @org_b_admin,
      role: "admin"
    )

    @org_b_tournament = Tournament.create!(
      organization: @org_b,
      name: "Org B Invitational",
      year: 2026,
      status: "open",
      registration_open: true
    )
    @org_b_group = Group.create!(
      tournament: @org_b_tournament,
      group_number: 1,
      hole_number: 1
    )
    @org_b_golfer = Golfer.create!(
      tournament: @org_b_tournament,
      group: @org_b_group,
      name: "Org B Golfer",
      email: "org-b-golfer-#{SecureRandom.hex(4)}@example.com",
      phone: "671-555-1000",
      payment_type: "pay_on_day",
      payment_status: "unpaid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )

    authenticate_as(@org_a_admin)
  end

  test "control case: org scoped admin endpoint denies cross-org access" do
    get "/api/v1/admin/organizations/#{@org_b.slug}/tournaments", headers: auth_headers
    assert_response :forbidden
  end

  test "org A admin cannot read org B tournament via global tournaments endpoint" do
    get "/api/v1/tournaments/#{@org_b_tournament.id}", headers: auth_headers
    assert_response :forbidden
  end

  test "org A admin cannot update org B tournament via global tournaments endpoint" do
    patch "/api/v1/tournaments/#{@org_b_tournament.id}",
          params: { tournament: { contact_name: "Cross Org Update" } },
          headers: auth_headers

    assert_response :forbidden
    assert_not_equal "Cross Org Update", @org_b_tournament.reload.contact_name
  end

  test "org A admin cannot read org B golfer via global golfers endpoint" do
    get "/api/v1/golfers/#{@org_b_golfer.id}", headers: auth_headers
    assert_response :forbidden
  end

  test "org A admin cannot update org B golfer via global golfers endpoint" do
    patch "/api/v1/golfers/#{@org_b_golfer.id}",
          params: { golfer: { company: "Cross Org Company" } },
          headers: auth_headers

    assert_response :forbidden
    assert_not_equal "Cross Org Company", @org_b_golfer.reload.company
  end

  test "org A admin cannot read org B group via global groups endpoint" do
    get "/api/v1/groups/#{@org_b_group.id}", headers: auth_headers
    assert_response :forbidden
  end
end
