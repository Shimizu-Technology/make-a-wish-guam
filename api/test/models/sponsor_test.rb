# frozen_string_literal: true

require "test_helper"

class SponsorTest < ActiveSupport::TestCase
  # Disable fixtures - we create test data directly
  self.use_transactional_tests = true
  fixtures []
  
  def setup
    @org = Organization.create!(
      name: "Test Org",
      slug: "test-org-sponsor"
    )
    
    @tournament = @org.tournaments.create!(
      name: "Test Tournament",
      slug: "test-tournament-sponsor-2026",
      year: 2026,
      status: "open",
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      }
    )
    
    @sponsor = @tournament.sponsors.create!(
      name: "Bank of Test",
      tier: "title",
      position: 1,
      active: true,
      website_url: "https://bankoftest.com"
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

  test "valid sponsor creation" do
    assert @sponsor.valid?
    assert_equal "Bank of Test", @sponsor.name
    assert_equal "title", @sponsor.tier
  end

  test "name is required" do
    @sponsor.name = nil
    assert_not @sponsor.valid?
  end

  test "tier must be valid" do
    @sponsor.tier = "invalid"
    assert_not @sponsor.valid?
    
    Sponsor::TIERS.each do |valid_tier|
      @sponsor.tier = valid_tier
      if valid_tier == "hole"
        @sponsor.course_key = "hibiscus"
        @sponsor.hole_number = 1
      end
      assert @sponsor.valid?, "#{valid_tier} should be valid"
    end
  end

  test "hole sponsor requires hole_number and course_key" do
    hole_sponsor = @tournament.sponsors.build(
      name: "Hole Sponsor",
      tier: "hole",
      position: 2
    )
    assert_not hole_sponsor.valid?

    hole_sponsor.course_key = "hibiscus"
    hole_sponsor.hole_number = 9
    assert hole_sponsor.valid?
  end

  test "hole_number must stay within the configured course range" do
    hole_sponsor = @tournament.sponsors.build(
      name: "Hole Sponsor",
      tier: "hole",
      position: 2,
      course_key: "hibiscus",
      hole_number: 0
    )
    assert_not hole_sponsor.valid?

    hole_sponsor.hole_number = 10
    assert_not hole_sponsor.valid?

    hole_sponsor.hole_number = 9
    assert hole_sponsor.valid?
  end

  test "tier_display returns formatted tier" do
    assert_equal "Title Sponsor", @sponsor.tier_display
    
    @sponsor.tier = "platinum"
    assert_equal "Platinum", @sponsor.tier_display
    
    @sponsor.tier = "hole"
    @sponsor.course_key = "hibiscus"
    @sponsor.hole_number = 9
    assert_equal "Hole Sponsor", @sponsor.tier_display
    assert_equal "Hibiscus 9", @sponsor.display_label
  end

  test "major? returns true for title and platinum only" do
    @sponsor.tier = "title"
    assert @sponsor.major?
    
    @sponsor.tier = "platinum"
    assert @sponsor.major?
    
    @sponsor.tier = "gold"
    assert_not @sponsor.major?
    
    @sponsor.tier = "silver"
    assert_not @sponsor.major?
    
    @sponsor.tier = "bronze"
    assert_not @sponsor.major?
  end

  test "hole_sponsor? returns true for hole tier" do
    @sponsor.tier = "title"
    assert_not @sponsor.hole_sponsor?
    
    @sponsor.tier = "hole"
    @sponsor.course_key = "hibiscus"
    @sponsor.hole_number = 1
    assert @sponsor.hole_sponsor?
  end

  test "hole sponsor rejects course keys not configured for the tournament" do
    hole_sponsor = @tournament.sponsors.build(
      name: "Hole Sponsor",
      tier: "hole",
      position: 2,
      course_key: "unknown",
      hole_number: 1
    )

    assert_not hole_sponsor.valid?
    assert_includes hole_sponsor.errors[:course_key], "is not configured for this event"
  end

  test "active scope filters inactive sponsors" do
    inactive = @tournament.sponsors.create!(
      name: "Inactive Sponsor",
      tier: "silver",
      position: 2,
      active: false
    )
    
    assert_includes @tournament.sponsors.active, @sponsor
    assert_not_includes @tournament.sponsors.active, inactive
  end

  test "major_sponsors scope returns title/platinum/gold" do
    platinum = @tournament.sponsors.create!(
      name: "Platinum Co",
      tier: "platinum",
      position: 2,
      active: true
    )
    silver = @tournament.sponsors.create!(
      name: "Silver Co",
      tier: "silver",
      position: 3,
      active: true
    )
    
    major = @tournament.sponsors.major_sponsors
    assert_includes major, @sponsor
    assert_includes major, platinum
    assert_not_includes major, silver
  end
end
