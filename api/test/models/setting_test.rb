require "test_helper"

class SettingTest < ActiveSupport::TestCase
  # ==================
  # Singleton Pattern
  # ==================

  test "instance returns existing setting" do
    existing = settings(:one)
    assert_equal existing.id, Setting.instance.id
  end

  test "instance creates setting if none exists" do
    Setting.delete_all
    assert_difference "Setting.count", 1 do
      Setting.instance
    end
  end

  # ==================
  # Attributes (Global Settings Only)
  # ==================

  test "stripe_public_key is accessible" do
    setting = settings(:one)
    assert_respond_to setting, :stripe_public_key
  end

  test "admin_email is accessible" do
    setting = settings(:one)
    assert_respond_to setting, :admin_email
  end

  test "payment_mode is accessible" do
    setting = settings(:one)
    assert_respond_to setting, :payment_mode
  end

  # ==================
  # Helper Methods
  # ==================

  test "stripe_configured? returns true when both keys present" do
    setting = Setting.new(
      stripe_public_key: "pk_test_xxx",
      stripe_secret_key: "sk_test_xxx"
    )
    assert setting.stripe_configured?
  end

  test "stripe_configured? returns false when keys missing" do
    setting = Setting.new(stripe_public_key: nil, stripe_secret_key: nil)
    assert_not setting.stripe_configured?
  end

  test "test_mode? returns true when payment_mode is test" do
    setting = Setting.new(payment_mode: 'test')
    assert setting.test_mode?
  end

  test "test_mode? returns true when payment_mode is nil" do
    setting = Setting.new(payment_mode: nil)
    assert setting.test_mode?
  end

  test "production_mode? returns true when payment_mode is production" do
    setting = Setting.new(payment_mode: 'production')
    assert setting.production_mode?
  end
end
