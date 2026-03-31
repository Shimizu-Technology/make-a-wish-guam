# frozen_string_literal: true

require "test_helper"

class GolferMagicLinkTest < ActiveSupport::TestCase
  self.use_transactional_tests = true
  fixtures []

  def setup
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org-magic"
    )
    
    @tournament = Tournament.create!(
      organization: @org,
      name: "Test Tournament",
      year: 2026,
      status: "open",
      registration_open: true,
      max_capacity: 100
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
    # Delete in dependency order to avoid foreign key violations
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
  # Magic Link Generation Tests
  # ==========================================

  test "generate_magic_link! creates a token" do
    assert_nil @golfer.magic_link_token
    
    token = @golfer.generate_magic_link!
    
    assert_not_nil token
    assert_equal token, @golfer.magic_link_token
    assert_not_nil @golfer.magic_link_expires_at
  end

  test "generate_magic_link! sets expiry to 24 hours from now" do
    freeze_time do
      @golfer.generate_magic_link!
      
      expected_expiry = Time.current + 24.hours
      assert_in_delta expected_expiry.to_i, @golfer.magic_link_expires_at.to_i, 1
    end
  end

  test "generate_magic_link! creates unique tokens" do
    token1 = @golfer.generate_magic_link!
    
    golfer2 = Golfer.create!(
      tournament: @tournament,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "671-555-5678",
      payment_type: "pay_on_day",
      payment_status: "unpaid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )
    token2 = golfer2.generate_magic_link!
    
    assert_not_equal token1, token2
  end

  test "generate_magic_link! overwrites existing token" do
    old_token = @golfer.generate_magic_link!
    new_token = @golfer.generate_magic_link!
    
    assert_not_equal old_token, new_token
    assert_equal new_token, @golfer.reload.magic_link_token
  end

  # ==========================================
  # Magic Link Validation Tests
  # ==========================================

  test "magic_link_valid? returns true for valid unexpired token" do
    @golfer.generate_magic_link!
    
    assert @golfer.magic_link_valid?
  end

  test "magic_link_valid? returns false when token is nil" do
    assert_not @golfer.magic_link_valid?
  end

  test "magic_link_valid? returns false when token is expired" do
    @golfer.generate_magic_link!
    
    # Manually expire the token
    @golfer.update!(magic_link_expires_at: 1.hour.ago)
    
    assert_not @golfer.magic_link_valid?
  end

  test "magic_link_valid? returns false when expiry is nil" do
    @golfer.update!(magic_link_token: "some_token", magic_link_expires_at: nil)
    
    assert_not @golfer.magic_link_valid?
  end

  # ==========================================
  # Clear Magic Link Tests
  # ==========================================

  test "clear_magic_link! removes token and expiry" do
    @golfer.generate_magic_link!
    assert_not_nil @golfer.magic_link_token
    
    @golfer.clear_magic_link!
    
    assert_nil @golfer.reload.magic_link_token
    assert_nil @golfer.magic_link_expires_at
  end

  # ==========================================
  # Magic Link URL Tests
  # ==========================================

  test "magic_link_url returns nil when no token" do
    assert_nil @golfer.magic_link_url
  end

  test "magic_link_url returns URL with token" do
    @golfer.generate_magic_link!
    
    url = @golfer.magic_link_url
    
    assert_includes url, "/score/verify?token="
    assert_includes url, @golfer.magic_link_token
  end

  # ==========================================
  # Find by Magic Link Tests
  # ==========================================

  test "find_by_magic_link returns golfer for valid token" do
    token = @golfer.generate_magic_link!
    
    found = Golfer.find_by_magic_link(token)
    
    assert_equal @golfer, found
  end

  test "find_by_magic_link returns nil for invalid token" do
    found = Golfer.find_by_magic_link("invalid_token")
    
    assert_nil found
  end

  test "find_by_magic_link returns nil for expired token" do
    token = @golfer.generate_magic_link!
    @golfer.update!(magic_link_expires_at: 1.hour.ago)
    
    found = Golfer.find_by_magic_link(token)
    
    assert_nil found
  end

  test "find_by_magic_link returns nil for blank token" do
    assert_nil Golfer.find_by_magic_link("")
    assert_nil Golfer.find_by_magic_link(nil)
  end

  # ==========================================
  # Find for Scoring Access Tests
  # ==========================================

  test "find_for_scoring_access returns golfers for email with active tournament" do
    golfers = Golfer.find_for_scoring_access("john@example.com")
    
    assert_equal 1, golfers.count
    assert_equal @golfer, golfers.first
  end

  test "find_for_scoring_access is case insensitive" do
    golfers = Golfer.find_for_scoring_access("JOHN@EXAMPLE.COM")
    
    assert_equal 1, golfers.count
  end

  test "find_for_scoring_access strips whitespace" do
    golfers = Golfer.find_for_scoring_access("  john@example.com  ")
    
    assert_equal 1, golfers.count
  end

  test "find_for_scoring_access excludes cancelled golfers" do
    @golfer.update!(registration_status: "cancelled")
    
    golfers = Golfer.find_for_scoring_access("john@example.com")
    
    assert_empty golfers
  end

  test "find_for_scoring_access excludes golfers from archived tournaments" do
    @tournament.update!(status: "archived")
    
    golfers = Golfer.find_for_scoring_access("john@example.com")
    
    assert_empty golfers
  end

  test "find_for_scoring_access includes golfers from in_progress tournaments" do
    @tournament.update!(status: "in_progress")
    
    golfers = Golfer.find_for_scoring_access("john@example.com")
    
    assert_equal 1, golfers.count
  end

  test "find_for_scoring_access returns empty for unknown email" do
    golfers = Golfer.find_for_scoring_access("unknown@example.com")
    
    assert_empty golfers
  end

  test "find_for_scoring_access returns empty for blank email" do
    assert_empty Golfer.find_for_scoring_access("")
    assert_empty Golfer.find_for_scoring_access(nil)
  end

  test "find_for_scoring_access returns multiple golfers for same email different tournaments" do
    tournament2 = Tournament.create!(
      organization: @org,
      name: "Second Tournament",
      year: 2026,
      status: "in_progress",
      registration_open: false
    )
    
    golfer2 = Golfer.create!(
      tournament: tournament2,
      name: "John Doe",
      email: "john@example.com",
      phone: "671-555-1234",
      payment_type: "pay_on_day",
      payment_status: "paid",
      registration_status: "confirmed",
      waiver_accepted_at: Time.current
    )
    
    golfers = Golfer.find_for_scoring_access("john@example.com")
    
    assert_equal 2, golfers.count
    assert_includes golfers, @golfer
    assert_includes golfers, golfer2
  end
end
