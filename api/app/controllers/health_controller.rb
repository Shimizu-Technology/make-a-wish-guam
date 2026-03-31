class HealthController < ApplicationController
  # GET /health
  def show
    render json: {
      status: "ok",
      timestamp: Time.current.iso8601,
      database: database_connected?,
      version: Rails::VERSION::STRING
    }
  end

  private

  def database_connected?
    ActiveRecord::Base.connection.active?
  rescue StandardError
    false
  end
end

