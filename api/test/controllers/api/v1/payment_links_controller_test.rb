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
end

