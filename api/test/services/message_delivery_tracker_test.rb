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

  test "nil delivery result marks an existing delivery as skipped and terminal" do
    delivery = MessageDelivery.create!(
      provider: "resend",
      channel: "email",
      purpose: "sponsor_portal_invite",
      recipient: "sponsor@example.com",
      status: "pending"
    )

    result = MessageDeliveryTracker.track_result!(delivery, nil)

    assert_equal false, result.fetch(:success)
    assert_equal "skipped", delivery.reload.status
    assert_equal "Delivery service not configured", delivery.error_text
    assert delivery.failed_at.present?
  end

  test "mark skipped stamps failed_at consistently" do
    delivery = MessageDelivery.create!(
      provider: "resend",
      channel: "email",
      purpose: "sponsor_portal_invite",
      recipient: "sponsor@example.com",
      status: "pending"
    )

    delivery.mark_skipped!("No configured provider")

    assert_equal "skipped", delivery.reload.status
    assert_equal "No configured provider", delivery.error_text
    assert delivery.failed_at.present?
  end

  test "raw string responses are wrapped before storing in response payload" do
    delivery = MessageDelivery.create!(
      provider: "clicksend",
      channel: "sms",
      purpose: "raffle_winner_notification",
      recipient: "+16715550123",
      status: "pending"
    )

    MessageDeliveryTracker.track_result!(
      delivery,
      { success: false, status: "failed", error: "http_500", raw_response: "upstream unavailable" }
    )

    delivery.reload
    assert_equal "failed", delivery.status
    assert_equal "upstream unavailable", delivery.response_payload.fetch("raw_response")
    assert delivery.failed_at.present?
  end
end
