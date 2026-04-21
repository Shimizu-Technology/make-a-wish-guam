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
end
