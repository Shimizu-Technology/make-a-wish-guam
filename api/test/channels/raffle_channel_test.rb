require "test_helper"

class RaffleChannelTest < ActionCable::Channel::TestCase
  test "public guests can subscribe to listed active tournament raffle stream" do
    tournament = tournaments(:tournament_one)
    tournament.update!(public_listed: true, status: "open")
    stub_connection current_admin: nil

    subscribe tournament_id: tournament.id

    assert subscription.confirmed?
    assert_has_stream "tournament_#{tournament.id}_raffle"
  end

  test "rejects archived tournament raffle stream" do
    tournament = tournaments(:tournament_one)
    tournament.update!(public_listed: true, status: "archived")
    stub_connection current_admin: nil

    subscribe tournament_id: tournament.id

    assert subscription.rejected?
  end
end
