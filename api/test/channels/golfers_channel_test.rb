require "test_helper"

class GolfersChannelTest < ActionCable::Channel::TestCase
  test "subscribes and streams from accessible tournament channels" do
    admin = users(:super_admin)
    tournament = tournaments(:tournament_one)
    stub_connection current_admin: admin

    subscribe
    assert subscription.confirmed?
    assert_has_stream "golfers_channel_#{tournament.id}"
  end

  test "rejects subscription when no authenticated admin is present" do
    stub_connection current_admin: nil

    subscribe
    assert subscription.rejected?
  end
end
