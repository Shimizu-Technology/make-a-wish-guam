# frozen_string_literal: true

require "jwt"

class GolferAuth
  # JWT secret - use Rails secret_key_base or a dedicated env var
  def self.secret_key
    ENV.fetch("GOLFER_JWT_SECRET") { Rails.application.secret_key_base }
  end

  # Token expires in 24 hours (same as magic link)
  TOKEN_EXPIRY = 24.hours

  class << self
    # Generate a JWT for a golfer session
    def generate_token(golfer)
      payload = {
        golfer_id: golfer.id,
        tournament_id: golfer.tournament_id,
        email: golfer.email,
        type: "golfer_session",
        iat: Time.current.to_i,
        exp: TOKEN_EXPIRY.from_now.to_i
      }

      JWT.encode(payload, secret_key, "HS256")
    end

    # Verify and decode a golfer JWT
    def verify(token)
      return nil if token.blank?

      decoded = JWT.decode(token, secret_key, true, { algorithm: "HS256" })
      payload = decoded.first

      # Verify it's a golfer session token
      return nil unless payload["type"] == "golfer_session"

      payload
    rescue JWT::ExpiredSignature
      Rails.logger.info("GolferAuth: Token expired")
      nil
    rescue JWT::DecodeError => e
      Rails.logger.warn("GolferAuth: Invalid token - #{e.message}")
      nil
    end

    # Get golfer from token
    def golfer_from_token(token)
      payload = verify(token)
      return nil unless payload

      Golfer.find_by(id: payload["golfer_id"])
    end
  end
end
