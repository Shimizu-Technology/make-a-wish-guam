# frozen_string_literal: true

require "test_helper"

class OrganizationTest < ActiveSupport::TestCase
  # Disable fixtures - we create test data directly
  self.use_transactional_tests = true
  fixtures []
  
  def setup
    @org = Organization.create!(
      name: "Rotary Club",
      slug: "rotary-test",
      description: "Test organization",
      primary_color: "#1e40af"
    )
  end

  def teardown
    # Delete in dependency order
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

  test "valid organization creation" do
    assert @org.valid?
    assert_equal "Rotary Club", @org.name
    assert_equal "rotary-test", @org.slug
  end

  test "name is required" do
    @org.name = nil
    assert_not @org.valid?
  end

  test "slug is required" do
    @org.slug = nil
    assert_not @org.valid?
  end

  test "slug must be unique" do
    duplicate = Organization.new(
      name: "Another Org",
      slug: "rotary-test"
    )
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:slug], "has already been taken"
  end

  test "tournaments are scoped to organization" do
    tournament1 = @org.tournaments.create!(
      name: "Rotary Classic",
      slug: "rotary-classic-2026",
      year: 2026,
      status: "open"
    )
    
    other_org = Organization.create!(
      name: "Chamber",
      slug: "chamber-test"
    )
    tournament2 = other_org.tournaments.create!(
      name: "Chamber Open",
      slug: "chamber-open-2026",
      year: 2026,
      status: "open"
    )
    
    assert_includes @org.tournaments, tournament1
    assert_not_includes @org.tournaments, tournament2
    
    assert_includes other_org.tournaments, tournament2
    assert_not_includes other_org.tournaments, tournament1
  end

  test "find_by_slug! finds organization" do
    found = Organization.find_by_slug!("rotary-test")
    assert_equal @org, found
  end

  test "find_by_slug! raises for invalid slug" do
    assert_raises(ActiveRecord::RecordNotFound) do
      Organization.find_by_slug!("nonexistent")
    end
  end

  test "tournament_count returns correct count" do
    assert_equal 0, @org.tournament_count
    
    @org.tournaments.create!(
      name: "Tournament 1",
      slug: "tournament-1-2026",
      year: 2026,
      status: "open"
    )
    @org.tournaments.create!(
      name: "Tournament 2",
      slug: "tournament-2-2026",
      year: 2026,
      status: "draft"
    )
    
    # Reload to refresh cache
    @org.reload
    assert_equal 2, @org.tournament_count
  end
end
