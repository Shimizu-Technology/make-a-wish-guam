require "test_helper"

class ApplicationCable::ConnectionTest < ActionCable::Connection::TestCase
  test "allows public guest connection without token" do
    connect "/cable"

    assert_nil connection.current_admin
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
