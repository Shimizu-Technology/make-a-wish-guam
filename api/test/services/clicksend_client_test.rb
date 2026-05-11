require "test_helper"

class ClicksendClientTest < ActiveSupport::TestCase
  test "normalizes top-level success with per-message failure as failed" do
    response = {
      "response_code" => "SUCCESS",
      "response_msg" => "Messages queued.",
      "data" => {
        "messages" => [
          {
            "message_id" => "sms_failed_123",
            "status_code" => "400",
            "status_text" => "INVALID_RECIPIENT"
          }
        ]
      }
    }

    result = ClicksendClient.send(:normalize_send_response, response)

    assert_equal false, result.fetch(:success)
    assert_equal "failed", result.fetch(:status)
    assert_equal "sms_failed_123", result.fetch(:message_id)
    assert_equal "INVALID_RECIPIENT", result.fetch(:error)
  end

  test "normalizes accepted per-message response" do
    response = {
      "response_code" => "SUCCESS",
      "response_msg" => "Messages queued.",
      "data" => {
        "messages" => [
          {
            "message_id" => "sms_ok_123",
            "status_code" => "200",
            "status_text" => "Success: Message queued."
          }
        ]
      }
    }

    result = ClicksendClient.send(:normalize_send_response, response)

    assert_equal true, result.fetch(:success)
    assert_equal "accepted", result.fetch(:status)
    assert_equal "sms_ok_123", result.fetch(:message_id)
  end
end
