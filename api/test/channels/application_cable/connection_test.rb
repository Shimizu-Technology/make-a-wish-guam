require "test_helper"

class ApplicationCable::ConnectionTest < ActionCable::Connection::TestCase
  test "rejects connection without token" do
    assert_reject_connection { connect "/cable" }
  end

  test "rejects connection with invalid token" do
    assert_reject_connection { connect "/cable?token=definitely_invalid" }
  end

  test "connects with valid token in query params" do
    admin = users(:super_admin)
    connect "/cable?token=test_token_#{admin.id}"

    assert_equal admin.id, connection.current_admin.id
  end
end
