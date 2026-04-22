require "test_helper"

class Api::V1::AdminsControllerTest < ActionDispatch::IntegrationTest
  def setup
    super
    @admin = admins(:admin_one)
    @admin.update!(clerk_id: "test_clerk_#{@admin.id}") if @admin.clerk_id.nil?
    @organization = organizations(:org_one)
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
    assert_difference "User.count", 1 do
      post api_v1_admins_url, params: {
        admin: { email: "new-admin@example.com" }
      }, headers: auth_headers
    end
    assert_response :created
    
    json = JSON.parse(response.body)
    assert_equal "new-admin@example.com", json["email"]
    assert @organization.organization_memberships.find_by(user_id: json["id"], role: "admin")
  end

  test "create reuses an existing user outside the organization" do
    other_org = Organization.create!(
      name: "Other Org",
      slug: "other-org-admins-test",
      subscription_status: "active"
    )
    existing_user = User.create!(
      email: "existing-admin@example.com",
      role: "org_admin",
      clerk_id: "existing_admin_#{SecureRandom.hex(4)}"
    )
    OrganizationMembership.create!(organization: other_org, user: existing_user, role: "admin")

    assert_no_difference "User.count" do
      post api_v1_admins_url, params: {
        admin: { email: existing_user.email }
      }, headers: auth_headers
    end

    assert_response :created
    assert @organization.organization_memberships.find_by(user: existing_user, role: "admin")
  end

  test "create rolls back membership add if existing user role update fails" do
    other_org = Organization.create!(
      name: "Other Org For Rollback",
      slug: "other-org-admins-rollback-test",
      subscription_status: "active"
    )
    existing_user = User.create!(
      email: "existing-admin-rollback@example.com",
      role: "tournament_admin",
      clerk_id: "existing_admin_rollback_#{SecureRandom.hex(4)}"
    )
    OrganizationMembership.create!(organization: other_org, user: existing_user, role: "admin")
    original_update = User.instance_method(:update!)

    User.send(:define_method, :update!) do |*args, **kwargs|
      if email == existing_user.email
        errors.add(:base, "blocked user cleanup")
        raise ActiveRecord::RecordInvalid.new(self)
      end

      original_update.bind_call(self, *args, **kwargs)
    end

    begin
      assert_no_difference "@organization.organization_memberships.count" do
        post api_v1_admins_url, params: {
          admin: { email: existing_user.email }
        }, headers: auth_headers
      end
    ensure
      User.send(:define_method, :update!, original_update)
    end

    assert_response :unprocessable_entity
    assert_nil @organization.organization_memberships.find_by(user: existing_user)
    assert_equal "tournament_admin", existing_user.reload.role
  end

  test "create returns error when email already exists in the organization" do
    post api_v1_admins_url, params: {
      admin: { email: @admin.email }
    }, headers: auth_headers
    
    assert_response :unprocessable_entity
  end

  # Note: Admin model doesn't validate email format for flexibility
  # Only presence and uniqueness are validated

  # ==================
  # DELETE /api/v1/admins/:id
  # ==================

  test "destroy removes an admin membership from the current organization" do
    admin_to_delete = User.create!(
      email: "removable-admin@example.com",
      role: "org_admin",
      clerk_id: "removable_admin_#{SecureRandom.hex(4)}"
    )
    OrganizationMembership.create!(organization: @organization, user: admin_to_delete, role: "admin")

    assert_difference "@organization.organization_memberships.count", -1 do
      delete api_v1_admin_url(admin_to_delete), headers: auth_headers
    end

    assert_response :no_content
    assert_nil User.find_by(id: admin_to_delete.id)
  end

  test "destroy rolls back membership removal if user cleanup fails" do
    admin_to_delete = User.create!(
      email: "blocked-admin@example.com",
      role: "org_admin",
      clerk_id: "blocked_admin_#{SecureRandom.hex(4)}"
    )
    membership = OrganizationMembership.create!(organization: @organization, user: admin_to_delete, role: "admin")

    blocker = proc do
      raise ActiveRecord::InvalidForeignKey, "blocked user cleanup" if email == admin_to_delete.email
    end

    User.set_callback(:destroy, :before, blocker)

    begin
      assert_no_difference "@organization.organization_memberships.count" do
        assert_raises(ActiveRecord::InvalidForeignKey) do
          delete api_v1_admin_url(admin_to_delete), headers: auth_headers
        end
      end
    ensure
      User.skip_callback(:destroy, :before, blocker)
    end

    assert OrganizationMembership.exists?(membership.id), "membership should remain when user deletion fails"
    assert User.exists?(admin_to_delete.id), "user should remain when transaction rolls back"
  end

  test "destroy cannot remove self" do
    delete api_v1_admin_url(@admin), headers: auth_headers
    assert_response :unprocessable_entity
  end

  test "show cannot access a user outside the current organization" do
    outsider_org = Organization.create!(
      name: "Outsider Org",
      slug: "outsider-org-admins-test",
      subscription_status: "active"
    )
    outsider = User.create!(
      email: "outsider@example.com",
      role: "org_admin",
      clerk_id: "outsider_admin_#{SecureRandom.hex(4)}"
    )
    OrganizationMembership.create!(organization: outsider_org, user: outsider, role: "admin")

    get api_v1_admin_url(outsider), headers: auth_headers

    assert_response :not_found
  end
end
