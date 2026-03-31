# frozen_string_literal: true

require "test_helper"

class Api::V1::GolferAuthControllerTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = true
  fixtures []

  def setup
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org-controller"
    )
    
    @tournament = Tournament.create!(
      organization: @org,
      name: "Test Tournament",
      year: 2026,
      status: "open",
      registration_open: true
    )
    
    @golfer = Golfer.create!(
      tournament: @tournament,
      name: "John Doe",
      email: "john@example.com",
      phone: "671-555-1234",
      payment_type: "pay_on_day",
      payment_status: "unpaid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )
  end

  def teardown
    Score.delete_all
    RaffleTicket.delete_all
    RafflePrize.delete_all
    Sponsor.delete_all
    Golfer.delete_all
    Group.delete_all
    ActivityLog.delete_all
    Tournament.delete_all
    OrganizationMembership.delete_all
    Organization.delete_all
  end

  # ==========================================
  # Request Link Tests
  # ==========================================

  test "request_link returns success for registered email" do
    post api_v1_golfer_auth_request_link_url, params: { email: "john@example.com" }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
    assert_includes json["message"], "you'll receive an email"
  end

  test "request_link generates magic link token" do
    assert_nil @golfer.magic_link_token
    
    post api_v1_golfer_auth_request_link_url, params: { email: "john@example.com" }
    
    @golfer.reload
    assert_not_nil @golfer.magic_link_token
    assert_not_nil @golfer.magic_link_expires_at
  end

  test "request_link returns success even for unknown email (prevents enumeration)" do
    post api_v1_golfer_auth_request_link_url, params: { email: "unknown@example.com" }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
  end

  test "request_link returns error for blank email" do
    post api_v1_golfer_auth_request_link_url, params: { email: "" }
    
    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_not json["success"]
    assert_includes json["error"], "Email is required"
  end

  test "request_link is case insensitive" do
    post api_v1_golfer_auth_request_link_url, params: { email: "JOHN@EXAMPLE.COM" }
    
    assert_response :success
    @golfer.reload
    assert_not_nil @golfer.magic_link_token
  end

  # ==========================================
  # Verify Tests
  # ==========================================

  test "verify returns token for valid magic link" do
    token = @golfer.generate_magic_link!
    
    get api_v1_golfer_auth_verify_url, params: { token: token }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
    assert_not_nil json["token"]
    assert_not_nil json["golfer"]
    assert_not_nil json["tournament"]
  end

  test "verify returns golfer details" do
    token = @golfer.generate_magic_link!
    
    get api_v1_golfer_auth_verify_url, params: { token: token }
    
    json = JSON.parse(response.body)
    assert_equal @golfer.id, json["golfer"]["id"]
    assert_equal @golfer.name, json["golfer"]["name"]
    assert_equal @golfer.email, json["golfer"]["email"]
  end

  test "verify returns tournament details" do
    token = @golfer.generate_magic_link!
    
    get api_v1_golfer_auth_verify_url, params: { token: token }
    
    json = JSON.parse(response.body)
    assert_equal @tournament.id, json["tournament"]["id"]
    assert_equal @tournament.name, json["tournament"]["name"]
  end

  test "verify clears the magic link after use" do
    token = @golfer.generate_magic_link!
    
    get api_v1_golfer_auth_verify_url, params: { token: token }
    
    @golfer.reload
    assert_nil @golfer.magic_link_token
    assert_nil @golfer.magic_link_expires_at
  end

  test "verify returns error for invalid token" do
    get api_v1_golfer_auth_verify_url, params: { token: "invalid" }
    
    assert_response :unauthorized
    json = JSON.parse(response.body)
    assert_not json["success"]
    assert_includes json["error"], "Invalid or expired"
  end

  test "verify returns error for expired token" do
    token = @golfer.generate_magic_link!
    @golfer.update!(magic_link_expires_at: 1.hour.ago)
    
    get api_v1_golfer_auth_verify_url, params: { token: token }
    
    assert_response :unauthorized
  end

  test "verify returns error for blank token" do
    get api_v1_golfer_auth_verify_url, params: { token: "" }
    
    assert_response :bad_request
    json = JSON.parse(response.body)
    assert_includes json["error"], "Token is required"
  end

  # ==========================================
  # Me Tests
  # ==========================================

  test "me returns golfer info with valid session token" do
    session_token = GolferAuth.generate_token(@golfer)
    
    get api_v1_golfer_auth_me_url, headers: { "Authorization" => "Bearer #{session_token}" }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
    assert_equal @golfer.id, json["golfer"]["id"]
  end

  test "me returns error without authorization" do
    get api_v1_golfer_auth_me_url
    
    assert_response :unauthorized
  end

  test "me returns error with invalid token" do
    get api_v1_golfer_auth_me_url, headers: { "Authorization" => "Bearer invalid" }
    
    assert_response :unauthorized
  end

  # ==========================================
  # Refresh Tests
  # ==========================================

  test "refresh returns new token" do
    old_token = GolferAuth.generate_token(@golfer)
    
    post api_v1_golfer_auth_refresh_url, headers: { "Authorization" => "Bearer #{old_token}" }
    
    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
    assert_not_nil json["token"]
    # New token should be different (different iat timestamp)
  end

  test "refresh returns error without authorization" do
    post api_v1_golfer_auth_refresh_url
    
    assert_response :unauthorized
  end
end
