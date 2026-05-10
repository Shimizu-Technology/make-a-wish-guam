require "test_helper"

class TournamentTest < ActiveSupport::TestCase
  test "requires organization" do
    tournament = Tournament.new(
      name: "Orphan Tournament",
      year: 2026,
      status: "draft"
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:organization], "must exist"
  end

  test "copy_for_next_year preserves organization" do
    original = tournaments(:tournament_one)
    copy = original.copy_for_next_year

    assert_equal original.organization_id, copy.organization_id
  end

  test "copy_for_next_year preserves event configuration but resets operational state" do
    original = tournaments(:tournament_one)
    original.update!(
      event_type: "golf_tournament",
      team_size: 2,
      tournament_format: "scramble",
      scoring_type: "gross",
      check_in_time: "06:30",
      contact_email: "events@example.test",
      entry_fee_display: "$300/team",
      raffle_enabled: true,
      raffle_ticket_price_cents: 500,
      raffle_description: "Event raffle",
      walkin_fee: 35000,
      walkin_registration_open: true,
      config: {
        "teams_per_start_position" => 2,
        "start_positions_per_hole" => 2,
        "raffle_include_with_registration" => true,
        "raffle_bundles" => [{ "quantity" => 4, "price_cents" => 2000, "label" => "$20 for 4 tickets" }]
      }
    )

    copy = original.copy_for_next_year

    assert_equal "draft", copy.status
    assert_not copy.registration_open
    assert_not copy.walkin_registration_open
    assert_nil copy.event_date
    assert_equal original.event_type, copy.event_type
    assert_equal 2, copy.team_size
    assert_equal original.tournament_format, copy.tournament_format
    assert_equal original.scoring_type, copy.scoring_type
    assert_equal original.check_in_time, copy.check_in_time
    assert_equal original.contact_email, copy.contact_email
    assert_equal original.entry_fee_display, copy.entry_fee_display
    assert_equal original.raffle_enabled, copy.raffle_enabled
    assert_equal original.raffle_ticket_price_cents, copy.raffle_ticket_price_cents
    assert_equal original.raffle_description, copy.raffle_description
    assert_equal original.walkin_fee, copy.walkin_fee
    assert_equal original.config, copy.config
  end

  test "open_registration only allows draft or closed events" do
    tournament = tournaments(:tournament_one)

    tournament.update!(status: "draft", registration_open: false)
    assert tournament.open_registration!
    assert_equal "open", tournament.status
    assert tournament.registration_open

    tournament.update!(status: "completed", registration_open: false)
    error = assert_raises(ActiveRecord::RecordInvalid) { tournament.open_registration! }
    assert_includes error.record.errors[:status], "must be draft or closed to open registration"
    assert_equal "completed", tournament.reload.status
    assert_not tournament.registration_open
  end

  test "rejects invalid course configs instead of silently dropping them" do
    tournament = tournaments(:tournament_one)

    tournament.assign_attributes(
      config: {
        course_configs: [
          { key: "hibiscus", name: "", hole_count: 9 },
          { key: "bouganvillea", name: "Bouganvillea", hole_count: 9 }
        ]
      },
      total_holes: 18
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Course configuration is invalid"
  end

  test "rejects course configs with more than 18 holes" do
    tournament = tournaments(:tournament_one)

    tournament.assign_attributes(
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus", hole_count: 19 }
        ]
      },
      total_holes: 19
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Course configuration is invalid"
  end

  test "rejects an explicitly empty course config list" do
    tournament = tournaments(:tournament_one)

    tournament.assign_attributes(
      config: { course_configs: [] },
      total_holes: 18
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "At least one course must be configured"
  end

  test "rejects duplicate explicit course config keys" do
    tournament = tournaments(:tournament_one)

    tournament.assign_attributes(
      config: {
        course_configs: [
          { key: "hibiscus", name: "Hibiscus Front", hole_count: 9 },
          { key: "hibiscus", name: "Hibiscus Back", hole_count: 9 }
        ]
      },
      total_holes: 18
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Course configuration keys must be unique"
  end

  test "rejects course config keys that collide with generated defaults" do
    tournament = tournaments(:tournament_one)

    tournament.assign_attributes(
      config: {
        course_configs: [
          { name: "Hibiscus", hole_count: 9 },
          { key: "course-1", name: "Bouganvillea", hole_count: 9 }
        ]
      },
      total_holes: 18
    )

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Course configuration keys must be unique"
  end

  test "course_configs cache reflects config changes on the same instance" do
    tournament = tournaments(:tournament_one)
    tournament.config = {
      course_configs: [
        { key: "hibiscus", name: "Hibiscus", hole_count: 9 }
      ]
    }

    assert_equal "Hibiscus", tournament.course_configs.first["name"]

    tournament.config["course_configs"][0]["name"] = "Bouganvillea"

    assert_equal "Bouganvillea", tournament.course_configs.first["name"]
  end

  test "saving without explicit course configs does not persist fallback config" do
    tournament = tournaments(:tournament_one)
    tournament.update_column(:config, { "sponsor_tiers" => [] })
    tournament.reload

    assert_equal({ "sponsor_tiers" => [] }, tournament.config)
    assert_equal "course-1", tournament.course_configs.first["key"]

    tournament.update!(name: "Updated Tournament Without Explicit Courses")

    assert_equal({ "sponsor_tiers" => [] }, tournament.reload.config)
    assert_equal "course-1", tournament.course_configs.first["key"]
  end

  test "teams_per_start_position defaults to one team per start position" do
    tournament = tournaments(:tournament_one)

    assert_equal 1, tournament.teams_per_start_position
  end

  test "start_positions_per_hole defaults to unlimited" do
    tournament = tournaments(:tournament_one)

    assert_nil tournament.start_positions_per_hole
  end

  test "players_per_start_position multiplies team size by teams per start position" do
    tournament = tournaments(:tournament_one)
    tournament.team_size = 2
    tournament.config = { "teams_per_start_position" => 2 }

    assert_equal 2, tournament.teams_per_start_position
    assert_equal 4, tournament.players_per_start_position
  end

  test "players_per_hole multiplies start slot capacity by pairings per hole" do
    tournament = tournaments(:tournament_one)
    tournament.team_size = 2
    tournament.config = {
      "teams_per_start_position" => 2,
      "start_positions_per_hole" => 2
    }

    assert_equal 2, tournament.start_positions_per_hole
    assert_equal 4, tournament.players_per_start_position
    assert_equal 4, tournament.teams_per_hole
    assert_equal 8, tournament.players_per_hole
  end

  test "rejects invalid teams_per_start_position config" do
    tournament = tournaments(:tournament_one)
    tournament.config = { "teams_per_start_position" => 0 }

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Teams per start position must be an integer between 1 and 4"
  end

  test "allows blank start_positions_per_hole config" do
    tournament = tournaments(:tournament_one)
    tournament.config = { "start_positions_per_hole" => "" }

    assert tournament.valid?
    assert_nil tournament.start_positions_per_hole
  end

  test "rejects invalid start_positions_per_hole config" do
    tournament = tournaments(:tournament_one)
    tournament.config = { "start_positions_per_hole" => 0 }

    assert_not tournament.valid?
    assert_includes tournament.errors[:config], "Start positions per hole must be blank or an integer between 1 and 26"
  end
end
