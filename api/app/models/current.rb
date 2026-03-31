# frozen_string_literal: true

# Current attributes for request-scoped data
# Used for multi-tenancy and auth context
class Current < ActiveSupport::CurrentAttributes
  attribute :organization
  attribute :user
  attribute :tournament

  def organization=(org)
    super
    # Could add organization-scoped logging here
  end

  def user=(usr)
    super
    # Could add user-scoped logging here
  end
end
