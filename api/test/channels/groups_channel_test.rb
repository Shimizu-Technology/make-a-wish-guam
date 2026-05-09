require "test_helper"

class GroupsChannelTest < ActionCable::Channel::TestCase
  test "subscribes authenticated admins to groups stream" do
    stub_connection current_admin: users(:super_admin)

    subscribe

    assert subscription.confirmed?
    assert_has_stream "groups_channel"
  end

  test "rejects subscription when no authenticated admin is present" do
    stub_connection current_admin: nil

    subscribe

    assert subscription.rejected?
  end
end
