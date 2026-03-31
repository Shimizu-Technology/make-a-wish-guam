# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  configured_origins = ENV.fetch("CORS_ALLOWED_ORIGINS", "")
                          .split(",")
                          .map(&:strip)
                          .reject(&:blank?)

  production_origins = ([ENV["FRONTEND_URL"], ENV["FRONTEND_URL_ALT"]] + configured_origins).compact.uniq
  production_origins = ["https://example.com"] if production_origins.empty?
  development_origins = [
    "localhost:3000", "localhost:3001", "localhost:5173", "localhost:5174", "localhost:5175", "localhost:5176",
    "127.0.0.1:3000", "127.0.0.1:3001", "127.0.0.1:5173", "127.0.0.1:5174", "127.0.0.1:5175", "127.0.0.1:5176"
  ]
  origins = Rails.env.production? ? production_origins : (development_origins + production_origins).uniq

  allow do
    # Keep production origins explicit and env-configurable.
    origins(*origins)

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true,
      expose: ["Authorization"]
  end
end
