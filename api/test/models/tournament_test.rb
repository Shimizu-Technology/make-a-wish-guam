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
end
