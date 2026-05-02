require "test_helper"

class Api::V1::PaymentLinksControllerTest < ActionDispatch::IntegrationTest
  # ==================
  # GET /api/v1/payment_links/:token (public)
  # ==================

  test "show returns golfer info for valid token" do
    golfer = golfers(:confirmed_unpaid)
    golfer.generate_payment_token!
    
    get "/api/v1/payment_links/#{golfer.payment_token}"
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json.key?("golfer")
    assert json.key?("tournament")
    assert json.key?("entry_fee_cents")
    assert_equal golfer.name, json["golfer"]["name"]
  end

  test "show returns 404 for invalid token" do
    get "/api/v1/payment_links/invalid_token_123"
    assert_response :not_found
  end

  test "show returns 422 for already paid golfer" do
    golfer = golfers(:confirmed_paid)
    golfer.generate_payment_token!
    
    get "/api/v1/payment_links/#{golfer.payment_token}"
    assert_response :unprocessable_entity
    
    json = JSON.parse(response.body)
    assert json["already_paid"]
  end

  test "show returns tournament entry fee" do
    golfer = golfers(:confirmed_unpaid)
    golfer.generate_payment_token!
    tournament = golfer.tournament

    get "/api/v1/payment_links/#{golfer.payment_token}"
    assert_response :success

    json = JSON.parse(response.body)
    assert_equal tournament.entry_fee, json["entry_fee_cents"]
  end

  # ==================
  # POST /api/v1/payment_links/:token/checkout (public)
  # ==================

  test "checkout returns error for invalid token" do
    post "/api/v1/payment_links/invalid_token_123/checkout"
    assert_response :not_found
  end

  test "checkout returns error for already paid golfer" do
    golfer = golfers(:confirmed_paid)
    golfer.generate_payment_token!
    
    post "/api/v1/payment_links/#{golfer.payment_token}/checkout"
    assert_response :unprocessable_entity
  end

  test "checkout confirms pending registration after test-mode payment link payment" do
    golfer = create_pending_golfer
    golfer.generate_payment_token!

    post "/api/v1/payment_links/#{golfer.payment_token}/checkout"

    assert_response :success
    golfer.reload
    assert_equal "paid", golfer.payment_status
    assert_equal "confirmed", golfer.registration_status
    assert_match(/\Atest_paylink_/, golfer.stripe_checkout_session_id)
  end

  private

  def create_pending_golfer
    tournaments(:tournament_one).golfers.create!(
      name: "Pending Payment Link Team",
      email: "pending-payment-link@example.com",
      phone: "671-555-3333",
      payment_type: "stripe",
      payment_status: "unpaid",
      registration_status: "pending",
      registration_source: "admin",
      waiver_accepted_at: Time.current,
      team_category: "Male"
    )
  end
end
