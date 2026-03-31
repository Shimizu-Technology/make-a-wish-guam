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
end
