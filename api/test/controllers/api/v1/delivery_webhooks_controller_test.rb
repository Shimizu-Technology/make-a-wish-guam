require "test_helper"

class Api::V1::DeliveryWebhooksControllerTest < ActionDispatch::IntegrationTest
  test "resend webhook updates matching delivery" do
    delivery = MessageDelivery.create!(
      provider: "resend",
      channel: "email",
      purpose: "sponsor_portal_invite",
      recipient: "sponsor@example.com",
      status: "accepted",
      provider_message_id: "email_123"
    )

    post "/api/v1/webhooks/resend",
         params: {
           type: "email.delivered",
           data: { email_id: "email_123" }
         }

    assert_response :success
    assert_equal "delivered", delivery.reload.status
    assert delivery.delivered_at.present?
    assert_equal 1, delivery.response_payload.fetch("events").length
  end

  test "clicksend webhook updates matching delivery failure" do
    delivery = MessageDelivery.create!(
      provider: "clicksend",
      channel: "sms",
      purpose: "raffle_winner_notification",
      recipient: "+16715550123",
      status: "accepted",
      provider_message_id: "sms_123"
    )

    post "/api/v1/webhooks/clicksend",
         params: {
           message_id: "sms_123",
           status_code: "400",
           status_text: "Message rejected by carrier",
           error_text: "Carrier rejected message"
         }

    assert_response :success
    assert_equal "failed", delivery.reload.status
    assert_equal "Carrier rejected message", delivery.error_text
    assert delivery.failed_at.present?
  end

  test "webhooks append intermediate events instead of replacing history" do
    delivery = MessageDelivery.create!(
      provider: "resend",
      channel: "email",
      purpose: "sponsor_portal_invite",
      recipient: "sponsor@example.com",
      status: "accepted",
      provider_message_id: "email_history_123"
    )

    post "/api/v1/webhooks/resend",
         params: {
           type: "email.delivery_delayed",
           data: { email_id: "email_history_123", reason: "Temporary deferral" }
         }
    assert_response :success

    post "/api/v1/webhooks/resend",
         params: {
           type: "email.delivered",
           data: { email_id: "email_history_123" }
         }
    assert_response :success

    delivery.reload
    assert_equal "delivered", delivery.status
    assert_equal 2, delivery.response_payload.fetch("events").length
    assert_equal [ "delayed", "delivered" ], delivery.response_payload.fetch("events").map { |event| event.fetch("status") }
  end
end
