require "test_helper"

class Api::V1::SponsorAccessControllerTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = true
  fixtures []

  def setup
    ActionMailer::Base.deliveries.clear
    @organization = Organization.create!(
      name: "Sponsor Test Org",
      slug: "sponsor-test-org"
    )
    @tournament = @organization.tournaments.create!(
      name: "Sponsor Access Tournament",
      slug: "sponsor-access-tournament-2026",
      year: 2026,
      status: "open",
      registration_open: true
    )
    @sponsor = @tournament.sponsors.create!(
      name: "Verified Sponsor",
      tier: "gold",
      position: 1,
      active: true,
      login_email: "sponsor@example.com",
      slot_count: 2
    )
    @access_token = @sponsor.generate_access_token!
  end

  def teardown
    Score.delete_all
    ActivityLog.delete_all
    SponsorSlot.delete_all
    Sponsor.delete_all
    Golfer.delete_all
    Group.delete_all
    Tournament.delete_all
    OrganizationMembership.delete_all
    Organization.delete_all
  end

  test "confirm returns a session token and sponsor slots reject the raw access token" do
    post "/api/v1/sponsor_access/confirm",
         params: { token: @access_token, email: @sponsor.login_email }

    assert_response :success

    json = JSON.parse(response.body)
    session_token = json["session_token"]

    assert session_token.present?
    assert_nil json["token"]

    get "/api/v1/sponsor_slots", headers: { "X-Sponsor-Token" => @access_token }
    assert_response :unauthorized

    get "/api/v1/sponsor_slots", headers: { "X-Sponsor-Session" => session_token }
    assert_response :success

    slots_json = JSON.parse(response.body)
    assert_equal 2, slots_json["slots"].length
  end

  test "request_link sends an access email for each active sponsor sharing the same login email" do
    second_sponsor = @tournament.sponsors.create!(
      name: "Second Sponsor",
      tier: "silver",
      position: 2,
      active: true,
      login_email: @sponsor.login_email,
      slot_count: 2
    )
    inactive_sponsor = @tournament.sponsors.create!(
      name: "Inactive Sponsor",
      tier: "bronze",
      position: 3,
      active: false,
      login_email: @sponsor.login_email,
      slot_count: 2
    )

    sent_sponsor_ids = []
    stub = ->(sponsor:, token:) do
      sent_sponsor_ids << sponsor.id
      { success: true, status: "accepted", message_id: "email_#{sponsor.id}" }
    end

    with_singleton_method(SponsorAccessEmailService, :send_access_link, stub) do
      post "/api/v1/sponsor_access/request_link",
           params: { email: @sponsor.login_email }
    end

    assert_response :success
    assert_equal [ @sponsor.id, second_sponsor.id ].sort, sent_sponsor_ids.sort
    assert @sponsor.reload.access_token.present?
    assert second_sponsor.reload.access_token.present?
    assert_nil inactive_sponsor.reload.access_token
  end

  private

  def with_singleton_method(klass, method_name, replacement)
    original = klass.method(method_name)
    klass.define_singleton_method(method_name, replacement)
    yield
  ensure
    klass.define_singleton_method(method_name, original)
  end
end
