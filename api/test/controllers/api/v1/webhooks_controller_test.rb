require "test_helper"

class Api::V1::WebhooksControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @setting = Setting.instance
    @original_env_webhook_secret = ENV["STRIPE_WEBHOOK_SECRET"]
    ENV["STRIPE_WEBHOOK_SECRET"] = nil
  end

  def teardown
    ENV["STRIPE_WEBHOOK_SECRET"] = @original_env_webhook_secret
    super
  end

  test "stripe webhook accepts unsigned payload when webhook secret is missing" do
    @setting.update!(
      stripe_secret_key: "sk_test_phase_c",
      stripe_webhook_secret: nil
    )

    payload = {
      id: "evt_unsigned_allowed",
      type: "unknown.event",
      data: { object: {} }
    }.to_json

    post "/api/v1/webhooks/stripe",
         params: payload,
         headers: { "CONTENT_TYPE" => "application/json" }

    assert_response :ok
  end

  test "stripe webhook fails closed in production when webhook secret is missing" do
    @setting.update!(
      stripe_secret_key: "sk_test_phase_c",
      stripe_webhook_secret: nil
    )

    payload = {
      id: "evt_missing_secret_production",
      type: "unknown.event",
      data: { object: {} }
    }.to_json

    original_env = Rails.env
    Rails.singleton_class.send(:define_method, :env) { ActiveSupport::StringInquirer.new("production") }

    begin
      post "/api/v1/webhooks/stripe",
           params: payload,
           headers: { "CONTENT_TYPE" => "application/json" }
    ensure
      Rails.singleton_class.send(:define_method, :env) { original_env }
    end

    assert_response :bad_request
  end

  test "stripe webhook rejects invalid signature when webhook secret is configured" do
    @setting.update!(
      stripe_secret_key: "sk_test_phase_c",
      stripe_webhook_secret: "whsec_phase_c"
    )

    payload = {
      id: "evt_invalid_signature",
      type: "unknown.event",
      data: { object: {} }
    }.to_json

    post "/api/v1/webhooks/stripe",
         params: payload,
         headers: {
           "CONTENT_TYPE" => "application/json",
           "HTTP_STRIPE_SIGNATURE" => "t=1111,v1=invalid"
         }

    assert_response :bad_request
  end

  test "forged checkout completed payload mutates golfer payment state when secret is missing" do
    golfer = golfers(:confirmed_unpaid)
    assert_equal "unpaid", golfer.payment_status

    @setting.update!(
      stripe_secret_key: "sk_test_phase_c",
      stripe_webhook_secret: nil
    )

    payload = {
      id: "evt_forged_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_forged_123",
          payment_intent: "pi_forged_123",
          metadata: { golfer_id: golfer.id.to_s }
        }
      }
    }.to_json

    post "/api/v1/webhooks/stripe",
         params: payload,
         headers: { "CONTENT_TYPE" => "application/json" }

    assert_response :ok
    golfer.reload
    assert_equal "paid", golfer.payment_status
    assert_equal "pi_forged_123", golfer.stripe_payment_intent_id
    assert_equal "stripe", golfer.payment_method
  end

  test "duplicate checkout completed delivery is idempotent for already paid golfer" do
    golfer = golfers(:confirmed_unpaid)
    @setting.update!(
      stripe_secret_key: "sk_test_phase_c",
      stripe_webhook_secret: nil
    )

    payload = {
      id: "evt_duplicate_delivery",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_duplicate_123",
          payment_intent: "pi_duplicate_123",
          metadata: { golfer_id: golfer.id.to_s }
        }
      }
    }.to_json

    post "/api/v1/webhooks/stripe",
         params: payload,
         headers: { "CONTENT_TYPE" => "application/json" }
    assert_response :ok

    golfer.reload
    first_updated_at = golfer.updated_at
    assert_equal "paid", golfer.payment_status

    assert_no_changes -> { golfer.reload.updated_at } do
      post "/api/v1/webhooks/stripe",
           params: payload,
           headers: { "CONTENT_TYPE" => "application/json" }
      assert_response :ok
    end

    assert_equal first_updated_at, golfer.reload.updated_at
    assert_equal "pi_duplicate_123", golfer.stripe_payment_intent_id
  end
end
