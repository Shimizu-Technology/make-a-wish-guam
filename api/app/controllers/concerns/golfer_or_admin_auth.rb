# frozen_string_literal: true

# Concern for endpoints that can be accessed by either:
# 1. Admin users (via Clerk JWT)
# 2. Golfers (via Golfer session JWT)
#
# Usage:
#   include GolferOrAdminAuth
#   before_action :authenticate_golfer_or_admin!
#
module GolferOrAdminAuth
  extend ActiveSupport::Concern

  private

  # Authenticate with either admin or golfer credentials
  # Sets @current_user (admin) OR @current_golfer
  def authenticate_golfer_or_admin!
    header = request.headers['Authorization']
    
    unless header.present?
      render_auth_error('Authorization required')
      return false
    end

    token = header.split(' ').last

    # Try golfer auth first (it's faster - no JWKS fetch)
    if authenticate_as_golfer(token)
      return true
    end

    # Fall back to admin auth
    if authenticate_as_admin(token)
      return true
    end

    render_auth_error('Invalid or expired token')
    false
  end

  # Try to authenticate as a golfer using GolferAuth service
  def authenticate_as_golfer(token)
    payload = GolferAuth.verify(token)
    return false unless payload

    @current_golfer = Golfer.find_by(id: payload['golfer_id'])
    return false unless @current_golfer

    # Verify golfer belongs to this tournament
    if @tournament && @current_golfer.tournament_id != @tournament.id
      return false
    end

    true
  end

  # Try to authenticate as an admin using Clerk
  def authenticate_as_admin(token)
    decoded = ClerkAuth.verify(token)
    return false unless decoded

    clerk_id = decoded['sub']
    email = decoded['email'] || decoded['primary_email_address']
    return false unless clerk_id

    @current_user = User.find_by_clerk_or_email(clerk_id: clerk_id, email: email)
    return false unless @current_user

    Current.user = @current_user
    true
  end

  # Check if current auth is a golfer
  def golfer_authenticated?
    @current_golfer.present?
  end

  # Check if current auth is an admin
  def admin_authenticated?
    @current_user.present?
  end

  # Get the current golfer (if authenticated as golfer)
  def current_golfer
    @current_golfer
  end

  # Verify golfer has access to a specific group
  def verify_golfer_group_access!(group_id)
    return true if admin_authenticated?
    
    if golfer_authenticated?
      unless @current_golfer.group_id == group_id.to_i
        render json: { 
          success: false, 
          error: 'You can only access your own group\'s scorecard' 
        }, status: :forbidden
        return false
      end
    end
    
    true
  end

  def render_auth_error(message)
    render json: { success: false, error: message }, status: :unauthorized
  end
end
