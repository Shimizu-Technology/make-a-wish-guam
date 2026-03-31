require "test_helper"

class RackAttackRateLimitingTest < ActionDispatch::IntegrationTest
  setup do
    @original_enabled = Rack::Attack.enabled
    Rack::Attack.enabled = true
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
  end

  teardown do
    Rack::Attack.enabled = @original_enabled
    Rack::Attack.reset!
  end

  test "throttles repeated public registration attempts per IP" do
    ip_env = { "REMOTE_ADDR" => "10.10.10.10" }

    10.times do
      post "/api/v1/golfers", params: {}, env: ip_env
      refute_equal 429, response.status
    end

    post "/api/v1/golfers", params: {}, env: ip_env
    assert_response :too_many_requests
  end

  test "throttles authenticated requests by bearer token fingerprint" do
    user = users(:super_admin)
    user.update!(clerk_id: "test_clerk_#{user.id}") if user.clerk_id.blank?

    headers = {
      "Authorization" => "Bearer test_token_#{user.id}"
    }
    ip_env = { "REMOTE_ADDR" => "10.10.20.20" }

    120.times do
      get "/api/v1/settings", headers: headers, env: ip_env
      refute_equal 429, response.status
    end

    get "/api/v1/settings", headers: headers, env: ip_env
    assert_response :too_many_requests
  end
end
