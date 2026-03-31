require "jwt"
require "net/http"
require "openssl"
require "digest"

class ClerkAuth
  class << self
    def verify(token)
      return nil if token.blank?

      # In test/development environment, allow special test tokens
      if (Rails.env.test? || Rails.env.development?) && token.start_with?("dev_token_")
        user_id = token.gsub("dev_token_", "")
        user = User.find_by(id: user_id) || User.find_by(email: user_id)
        if user
          return {
            "sub" => user.clerk_id || "dev_clerk_#{user.id}",
            "email" => user.email,
            "name" => user.name
          }
        end
        return nil
      end

      # Legacy test token support
      if Rails.env.test? && token.start_with?("test_token_")
        user_id = token.gsub("test_token_", "")
        user = User.find_by(id: user_id)
        if user
          return {
            "sub" => user.clerk_id || "test_clerk_#{user.id}",
            "email" => user.email,
            "name" => user.name
          }
        end
        return nil
      end

      decode_with_jwks(token, fetch_jwks)
    rescue JWT::DecodeError => e
      # Clerk rotates keys; if we have a stale cached JWKS, refresh once and retry.
      if e.message.include?("Could not find public key for kid")
        Rails.logger.warn("JWT key not found in cached JWKS, forcing refresh and retry")
        refreshed_jwks = fetch_jwks(force_refresh: true)
        return decode_with_jwks(token, refreshed_jwks)
      end

      Rails.logger.error("JWT decode error: #{e.message}")
      nil
    rescue StandardError => e
      Rails.logger.error("ClerkAuth error: #{e.message}")
      nil
    end

    private

    def decode_with_jwks(token, jwks)
      return nil if jwks.nil?

      decoded = JWT.decode(token, nil, true, {
        algorithms: ["RS256"],
        jwks: jwks
      })

      decoded.first
    end

    def fetch_jwks(force_refresh: false)
      jwks_url = ENV["CLERK_JWKS_URL"]

      if jwks_url.blank?
        Rails.logger.warn("CLERK_JWKS_URL not set, authentication disabled")
        return nil
      end

      cache_key = "clerk_jwks:#{Digest::SHA256.hexdigest(jwks_url)}"

      # Cache JWKS for 1 hour, scoped per JWKS URL.
      Rails.cache.delete(cache_key) if force_refresh
      Rails.cache.fetch(cache_key, expires_in: 1.hour) do
        uri = URI(jwks_url)
        
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.open_timeout = 5
        http.read_timeout = 5
        
        # In development, be more lenient with SSL verification
        # In production, this should use proper CA certificates
        if Rails.env.development?
          http.verify_mode = OpenSSL::SSL::VERIFY_NONE
        else
          http.verify_mode = OpenSSL::SSL::VERIFY_PEER
        end
        
        request = Net::HTTP::Get.new(uri.request_uri)
        response = http.request(request)

        if response.is_a?(Net::HTTPSuccess)
          data = JSON.parse(response.body)
          { keys: data["keys"] }
        else
          Rails.logger.error("Failed to fetch JWKS: #{response.code}")
          nil
        end
      end
    rescue StandardError => e
      Rails.logger.error("Failed to fetch JWKS: #{e.message}")
      nil
    end
  end
end

