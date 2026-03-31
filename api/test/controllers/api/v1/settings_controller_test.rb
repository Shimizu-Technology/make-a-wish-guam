require "test_helper"

class Api::V1::SettingsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/settings
  # ==================

  test "show returns global settings" do
    get api_v1_settings_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    # Global settings should be present
    assert json.key?("stripe_public_key")
    assert json.key?("payment_mode")
    assert json.key?("admin_email")
    assert json.key?("stripe_configured")
    assert json.key?("test_mode")
  end

  test "show requires authentication" do
    get api_v1_settings_url
    assert_response :unauthorized
  end

  # ==================
  # PATCH /api/v1/settings
  # ==================

  test "update modifies payment_mode" do
    patch api_v1_settings_url, params: {
      setting: { payment_mode: "production" }
    }, headers: auth_headers
    
    assert_response :success
    
    setting = Setting.instance
    assert_equal "production", setting.payment_mode
  end

  test "update modifies admin_email" do
    patch api_v1_settings_url, params: {
      setting: { admin_email: "new-admin@test.com" }
    }, headers: auth_headers
    
    assert_response :success
    
    setting = Setting.instance
    assert_equal "new-admin@test.com", setting.admin_email
  end

  test "update modifies stripe keys" do
    patch api_v1_settings_url, params: {
      setting: {
        stripe_public_key: "pk_test_new",
        stripe_secret_key: "sk_test_new"
      }
    }, headers: auth_headers
    
    assert_response :success
    
    setting = Setting.instance
    assert_equal "pk_test_new", setting.stripe_public_key
    assert_equal "sk_test_new", setting.stripe_secret_key
  end

  test "update logs activity" do
    assert_difference "ActivityLog.count", 1 do
      patch api_v1_settings_url, params: {
        setting: { payment_mode: "production" }
      }, headers: auth_headers
    end
    
    log = ActivityLog.last
    assert_equal "settings_updated", log.action
  end
end
