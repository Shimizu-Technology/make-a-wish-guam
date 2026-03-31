module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_admin

    def connect
      self.current_admin = find_verified_admin
    end

    private

    def find_verified_admin
      token = request.params[:token].presence || bearer_token_from_header
      reject_unauthorized_connection if token.blank?

      decoded = ClerkAuth.verify(token)
      reject_unauthorized_connection if decoded.blank?

      clerk_id = decoded["sub"]
      email = decoded["email"] || decoded["primary_email_address"]
      reject_unauthorized_connection if clerk_id.blank?

      user = User.find_by_clerk_or_email(clerk_id: clerk_id, email: email)
      reject_unauthorized_connection if user.blank?

      user
    rescue StandardError
      reject_unauthorized_connection
    end

    def bearer_token_from_header
      auth_header = request.headers["Authorization"]
      return nil unless auth_header.present?

      auth_header.split(" ").last
    end
  end
end

