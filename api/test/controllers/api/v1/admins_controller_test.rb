require "test_helper"

class Api::V1::AdminsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/admins
  # ==================

  test "index returns all admins" do
    get api_v1_admins_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length > 0
  end

  test "index requires authentication" do
    get api_v1_admins_url
    assert_response :unauthorized
  end

  # ==================
  # POST /api/v1/admins
  # ==================

  test "create adds new admin by email" do
    assert_difference "Admin.count", 1 do
      post api_v1_admins_url, params: {
        admin: { email: "new-admin@example.com" }
      }, headers: auth_headers
    end
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal "new-admin@example.com", json["email"]
  end

  test "create returns error for duplicate email" do
    existing = admins(:admin_two)
    
    post api_v1_admins_url, params: {
      admin: { email: existing.email }
    }, headers: auth_headers
    
    assert_response :unprocessable_entity
  end

  # Note: Admin model doesn't validate email format for flexibility
  # Only presence and uniqueness are validated

  # ==================
  # DELETE /api/v1/admins/:id
  # ==================

  test "destroy removes admin" do
    admin_to_delete = admins(:admin_no_clerk)
    
    assert_difference "Admin.count", -1 do
      delete api_v1_admin_url(admin_to_delete), headers: auth_headers
    end
    assert_response :no_content
  end

  test "destroy cannot remove self" do
    delete api_v1_admin_url(@admin), headers: auth_headers
    assert_response :unprocessable_entity
  end
end

