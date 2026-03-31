ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
    def admins(*fixture_names)
      mapped_names = fixture_names.map do |name|
        case name.to_s
        when "admin_one" then :user_one
        when "admin_two" then :super_admin
        when "admin_no_clerk" then :user_no_clerk
        else
          name
        end
      end

      records = users(*mapped_names)
      return Admin.find(records.id) unless records.is_a?(Array)

      records.map { |record| Admin.find(record.id) }
    end
  end
end

module ActionDispatch
  class IntegrationTest
    # Set up test admin for authentication
    def setup
      super
      @current_test_admin = nil
    end

    # Helper to authenticate as an admin for controller tests
    def authenticate_as(admin)
      @current_test_admin = admin
    end

    def auth_headers
      # Return headers with test token that ClerkAuth will recognize
      if @current_test_admin
        { "Authorization" => "Bearer test_token_#{@current_test_admin.id}" }
      else
        {}
      end
    end
  end
end
