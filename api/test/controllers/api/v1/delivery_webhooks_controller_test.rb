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
end
