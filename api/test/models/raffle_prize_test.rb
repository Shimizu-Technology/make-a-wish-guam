# frozen_string_literal: true

require "test_helper"

class RafflePrizeTest < ActiveSupport::TestCase
  # Disable fixtures - we create test data directly
  self.use_transactional_tests = true
  fixtures []
  
  def setup
    # Create test data without fixtures
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org"
    )
    
    @tournament = @org.tournaments.create!(
      name: "Test Tournament",
      slug: "test-tournament-2026",
      year: 2026,
      status: "open",
      raffle_enabled: true
    )
    
    @prize = @tournament.raffle_prizes.create!(
      name: "Grand Prize",
      tier: "grand",
      value_cents: 100000,
      position: 1
    )
    
    # Create some test tickets
    @golfer = @tournament.golfers.create!(
      name: "John Doe",
      email: "john@test.com",
      phone: "671-555-1234",
      registration_status: "confirmed",
      payment_status: "paid",
      payment_type: "pay_on_day",
      waiver_accepted_at: Time.current
    )
    
    3.times do |i|
      @tournament.raffle_tickets.create!(
        golfer: @golfer,
        purchaser_name: "John Doe",
        purchaser_email: "john@test.com",
        purchaser_phone: "671-555-1234",
        ticket_number: "TEST-#{i + 1}",
        payment_status: "paid",
        price_cents: 500
      )
    end
  end

  def teardown
    Score.delete_all
    # Clear winning ticket references first
    RafflePrize.update_all(winning_ticket_id: nil)
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

  test "valid prize creation" do
    assert @prize.valid?
    assert_equal "Grand Prize", @prize.name
    assert_equal "grand", @prize.tier
    assert_equal 1000.0, @prize.value_dollars
  end

  test "tier must be valid" do
    @prize.tier = "invalid"
    assert_not @prize.valid?
    assert_includes @prize.errors[:tier], "is not included in the list"
  end

  test "name is required" do
    @prize.name = nil
    assert_not @prize.valid?
    assert_includes @prize.errors[:name], "can't be blank"
  end

  test "draw_winner! selects a paid ticket" do
    assert_not @prize.won?
    
    result = @prize.draw_winner!
    
    assert result, "draw_winner! should return true"
    assert @prize.won?
    assert_not_nil @prize.won_at
    assert_not_nil @prize.winning_ticket
    assert_equal "John Doe", @prize.winner_name
    assert_equal "john@test.com", @prize.winner_email
  end

  test "draw_winner! fails if no tickets available" do
    RaffleTicket.delete_all
    
    result = @prize.draw_winner!
    
    assert_not result, "draw_winner! should return false when no tickets"
    assert_not @prize.won?
  end

  test "draw_winner! fails if already won" do
    @prize.draw_winner!
    
    result = @prize.draw_winner!
    
    assert_not result, "draw_winner! should return false if already won"
  end

  test "reset! clears winner" do
    @prize.draw_winner!
    assert @prize.won?
    
    @prize.reset!
    
    assert_not @prize.won?
    assert_nil @prize.winner_name
    assert_nil @prize.winning_ticket
  end

  test "claim! marks prize as claimed" do
    @prize.draw_winner!
    assert_not @prize.claimed?
    
    @prize.claim!
    
    assert @prize.claimed?
    assert_not_nil @prize.claimed_at
  end

  test "claim! fails if not won" do
    result = @prize.claim!
    
    assert_not result
    assert_not @prize.claimed?
  end

  test "tier_display returns formatted tier" do
    assert_equal "Grand", @prize.tier_display
    
    @prize.tier = "platinum"
    assert_equal "Platinum", @prize.tier_display
  end
end
