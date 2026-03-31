require "test_helper"

class AdminTest < ActiveSupport::TestCase
  # ==================
  # Validations
  # ==================

  test "should be valid with email" do
    admin = Admin.new(email: "new-admin@test.com")
    assert admin.valid?
  end

  test "should require email" do
    admin = Admin.new(email: nil)
    assert_not admin.valid?
    assert_includes admin.errors[:email], "can't be blank"
  end

  test "should require unique email" do
    existing = admins(:admin_one)
    admin = Admin.new(email: existing.email)
    assert_not admin.valid?
    assert_includes admin.errors[:email], "has already been taken"
  end

  # Note: Admin model only validates email presence and uniqueness
  # Email format validation is not currently enforced
  # This is intentional for flexibility in admin whitelist

  test "clerk_id is optional" do
    admin = Admin.new(email: "no-clerk@test.com", clerk_id: nil)
    assert admin.valid?
  end

  test "name is optional" do
    admin = Admin.new(email: "no-name@test.com", name: nil)
    assert admin.valid?
  end

  # ==================
  # Class Methods
  # ==================

  test "find_by_clerk_or_email finds by clerk_id first" do
    admin = admins(:admin_one)
    found = Admin.find_by_clerk_or_email(
      clerk_id: admin.clerk_id,
      email: "different@email.com"
    )
    assert_equal admin.id, found.id
  end

  test "find_by_clerk_or_email finds by email when clerk_id not found" do
    admin = admins(:admin_one)
    found = Admin.find_by_clerk_or_email(
      clerk_id: "non-existent-clerk-id",
      email: admin.email
    )
    assert_equal admin.id, found.id
  end

  test "find_by_clerk_or_email returns nil when neither found" do
    found = Admin.find_by_clerk_or_email(
      clerk_id: "non-existent",
      email: "non-existent@test.com"
    )
    assert_nil found
  end

  test "find_by_clerk_or_email finds admin without clerk_id by email" do
    admin = admins(:admin_no_clerk)
    found = Admin.find_by_clerk_or_email(
      clerk_id: "new-clerk-id",
      email: admin.email
    )
    assert_equal admin.id, found.id
  end

  # ==================
  # Instance Methods
  # ==================

  test "super_admin? returns true for super_admin role" do
    admin = admins(:admin_two)
    assert admin.super_admin?
  end

  test "super_admin? returns false for admin role" do
    admin = admins(:admin_one)
    assert_not admin.super_admin?
  end

  # ==================
  # Associations
  # ==================

  test "has many activity_logs" do
    admin = admins(:admin_one)
    assert_respond_to admin, :activity_logs
  end
end
