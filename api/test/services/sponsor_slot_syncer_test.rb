require "test_helper"

class SponsorSlotSyncerTest < ActiveSupport::TestCase
  test "clearing a captain slot cancels the golfer and removes them from their group" do
    tournament = tournaments(:tournament_one)
    sponsor = tournament.sponsors.create!(
      name: "Portal Sponsor",
      tier: "gold",
      position: 10,
      active: true,
      login_email: "portal-sponsor@example.com",
      slot_count: 2
    )
    group = tournament.groups.create!(
      group_number: 77,
      starting_course_key: "course-1",
      hole_number: 12
    )
    golfer = tournament.golfers.create!(
      name: "Portal Captain",
      email: "portal-captain@example.com",
      phone: "671-555-0107",
      payment_type: "sponsor",
      payment_status: "paid",
      registration_status: "confirmed",
      sponsor: sponsor,
      sponsor_name: sponsor.name,
      team_name: "#{sponsor.name} - Team 1",
      company: sponsor.name,
      waiver_accepted_at: Time.current,
      team_category: "Male",
      partner_name: "Portal Partner",
      group: group,
      position: 1
    )
    captain_slot = sponsor.sponsor_slots.find_by!(slot_number: 1)
    captain_slot.update!(player_name: nil, player_email: nil, player_phone: nil)

    SponsorSlotSyncer.new(sponsor).sync_slot(captain_slot)

    golfer.reload
    assert_equal "cancelled", golfer.registration_status
    assert_nil golfer.group_id
    assert_nil golfer.position
  end
end
