require "test_helper"

class Api::V1::GroupsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    authenticate_as(@admin)
  end

  # ==================
  # GET /api/v1/groups
  # ==================

  test "index returns all groups" do
    get api_v1_groups_url, headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_kind_of Array, json
    assert json.length > 0
  end

  test "index requires authentication" do
    get api_v1_groups_url
    assert_response :unauthorized
  end

  # ==================
  # GET /api/v1/groups/:id
  # ==================

  test "show returns group with golfers" do
    group = groups(:group_one)
    get api_v1_group_url(group), headers: auth_headers
    assert_response :success
    
    json = JSON.parse(response.body)
    assert_equal group.group_number, json["group_number"]
    assert json.key?("golfers")
  end

  test "show returns 404 for non-existent group" do
    get api_v1_group_url(id: 999999), headers: auth_headers
    assert_response :not_found
  end

  # ==================
  # POST /api/v1/groups
  # ==================

  test "create adds new group with auto-assigned number" do
    # Controller auto-assigns the next group number
    expected_number = Group.maximum(:group_number).to_i + 1
    
    assert_difference "Group.count", 1 do
      post api_v1_groups_url, params: {
        hole_number: 10
      }, headers: auth_headers
    end
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal expected_number, json["group_number"]
    assert_equal 10, json["hole_number"]
  end

  test "create assigns sequential group numbers" do
    initial_max = Group.maximum(:group_number).to_i
    
    post api_v1_groups_url, params: { hole_number: nil }, headers: auth_headers
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal initial_max + 1, json["group_number"]
  end

  # ==================
  # PATCH /api/v1/groups/:id
  # ==================

  test "update modifies group" do
    group = groups(:group_three)
    
    patch api_v1_group_url(group), params: {
      group: { hole_number: 15 }
    }, headers: auth_headers
    
    assert_response :success
    group.reload
    assert_equal 15, group.hole_number
  end

  # ==================
  # DELETE /api/v1/groups/:id
  # ==================

  test "destroy removes group" do
    group = groups(:group_three)
    group.golfers.update_all(group_id: nil)
    
    assert_difference "Group.count", -1 do
      delete api_v1_group_url(group), headers: auth_headers
    end
    assert_response :no_content
  end
end

