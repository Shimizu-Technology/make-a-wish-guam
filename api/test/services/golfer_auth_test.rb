# frozen_string_literal: true

require "test_helper"

class GolferAuthTest < ActiveSupport::TestCase
  self.use_transactional_tests = true
  fixtures []

  def setup
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org-auth"
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
  # Token Generation Tests
  # ==========================================

  test "generate_token creates a valid JWT" do
    token = GolferAuth.generate_token(@golfer)
    
    assert_not_nil token
    assert token.is_a?(String)
    assert token.split(".").length == 3  # JWT has 3 parts
  end

  test "generate_token includes golfer information in payload" do
    token = GolferAuth.generate_token(@golfer)
    payload = GolferAuth.verify(token)
    
    assert_equal @golfer.id, payload["golfer_id"]
    assert_equal @tournament.id, payload["tournament_id"]
    assert_equal @golfer.email, payload["email"]
    assert_equal "golfer_session", payload["type"]
  end

  test "generate_token includes expiry timestamp" do
    freeze_time do
      token = GolferAuth.generate_token(@golfer)
      payload = GolferAuth.verify(token)
      
      expected_exp = 24.hours.from_now.to_i
      assert_in_delta expected_exp, payload["exp"], 1
    end
  end

  # ==========================================
  # Token Verification Tests
  # ==========================================

  test "verify returns payload for valid token" do
    token = GolferAuth.generate_token(@golfer)
    payload = GolferAuth.verify(token)
    
    assert_not_nil payload
    assert_equal @golfer.id, payload["golfer_id"]
  end

  test "verify returns nil for blank token" do
    assert_nil GolferAuth.verify("")
    assert_nil GolferAuth.verify(nil)
  end

  test "verify returns nil for invalid token" do
    assert_nil GolferAuth.verify("invalid.token.here")
  end

  test "verify returns nil for tampered token" do
    token = GolferAuth.generate_token(@golfer)
    tampered = token[0..-5] + "XXXX"  # Modify the signature
    
    assert_nil GolferAuth.verify(tampered)
  end

  test "verify returns nil for expired token" do
    # Generate token, then travel past expiry
    token = GolferAuth.generate_token(@golfer)
    
    travel 25.hours do
      assert_nil GolferAuth.verify(token)
    end
  end

  # ==========================================
  # Golfer from Token Tests
  # ==========================================

  test "golfer_from_token returns golfer for valid token" do
    token = GolferAuth.generate_token(@golfer)
    golfer = GolferAuth.golfer_from_token(token)
    
    assert_equal @golfer, golfer
  end

  test "golfer_from_token returns nil for invalid token" do
    assert_nil GolferAuth.golfer_from_token("invalid")
  end

  test "golfer_from_token returns nil if golfer no longer exists" do
    token = GolferAuth.generate_token(@golfer)
    @golfer.destroy
    
    assert_nil GolferAuth.golfer_from_token(token)
  end
end
