# frozen_string_literal: true

require "digest"

class Rack::Attack
  # Enable throttling by default in production.
  # Non-production can opt in via ENABLE_RATE_LIMITING=true.
  self.enabled = ENV.fetch("ENABLE_RATE_LIMITING", Rails.env.production?.to_s) == "true"

  # Trust localhost in non-production to avoid disrupting local development workflows.
  safelist("allow-localhost-dev") do |req|
    !Rails.env.production? && ["127.0.0.1", "::1"].include?(req.ip)
  end

  # Public endpoints are most exposed to abuse.
  throttle("req/ip/public-registration", limit: 10, period: 1.minute) do |req|
    next unless req.post?
    next unless req.path == "/api/v1/golfers" || req.path.match?(%r{\A/api/v1/payment_links/[^/]+/checkout\z})

    req.ip
  end

  throttle("req/ip/public-checkout", limit: 10, period: 1.minute) do |req|
    next unless req.post?
    next unless ["/api/v1/checkout", "/api/v1/checkout/embedded", "/api/v1/checkout/confirm"].include?(req.path)

    req.ip
  end

  # Authenticated traffic throttle keyed by bearer token fingerprint.
  throttle("req/token/authenticated", limit: 120, period: 1.minute) do |req|
    auth_header = req.get_header("HTTP_AUTHORIZATION").to_s
    token = auth_header.split(" ").last
    next if token.blank?

    Digest::SHA256.hexdigest(token)
  end

  # Return JSON 429 for API clients.
  self.throttled_responder = lambda do |_request|
    [
      429,
      { "Content-Type" => "application/json" },
      [{ error: "Rate limit exceeded. Please try again shortly." }.to_json]
    ]
  end
end

Rails.application.config.middleware.use Rack::Attack
