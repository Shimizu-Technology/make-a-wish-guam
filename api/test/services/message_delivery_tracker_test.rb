require "test_helper"

class MessageDeliveryTrackerTest < ActiveSupport::TestCase
  test "create returns nil instead of blocking sends when tracking validation fails" do
    assert_nothing_raised do
      delivery = MessageDeliveryTracker.create!(
        provider: "unsupported",
        channel: "email",
        purpose: "sponsor_portal_invite",
        recipient: "sponsor@example.com"
      )
      assert_nil delivery
    end
  end

  test "normalize status maps provider statuses without unreachable exact branches" do
    assert_equal "accepted", MessageDelivery.normalize_status("sent")
    assert_equal "accepted", MessageDelivery.normalize_status("200")
    assert_equal "delivered", MessageDelivery.normalize_status("Message delivered to the handset")
    assert_equal "bounced", MessageDelivery.normalize_status("hard_bounce")
    assert_equal "delayed", MessageDelivery.normalize_status("delivery_delayed")
    assert_equal "complained", MessageDelivery.normalize_status("complaint")
    assert_equal "skipped", MessageDelivery.normalize_status("skipped")
    assert_equal "failed", MessageDelivery.normalize_status("invalid recipient")
  end
end
