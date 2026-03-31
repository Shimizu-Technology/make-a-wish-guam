# frozen_string_literal: true

module Authenticated
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user!
  end

  private

  def authenticate_user!
    header = request.headers['Authorization']

    unless header.present?
      render_unauthorized('Missing authorization header')
      return
    end

    token = header.split(' ').last
    decoded = ClerkAuth.verify(token)

    unless decoded
      render_unauthorized('Invalid or expired token')
      return
    end

    # Extract Clerk user ID and email from the token
    clerk_id = decoded['sub']
    email = decoded['email'] || decoded['primary_email_address']

    unless clerk_id
      render_unauthorized('Invalid token payload')
      return
    end

    # Find user by clerk_id or email
    @current_user = User.find_by_clerk_or_email(clerk_id: clerk_id, email: email)

    unless @current_user
      render_unauthorized('Access denied. You are not authorized. Please contact an administrator.')
      return
    end

    # Set Current context
    Current.user = @current_user

    # Extract name from Clerk token
    clerk_name = decoded['name'] || decoded['first_name'] ||
                 [decoded['first_name'], decoded['last_name']].compact.join(' ').presence

    # Update user record if needed
    updates = {}
    updates[:clerk_id] = clerk_id if @current_user.clerk_id.nil?
    updates[:name] = clerk_name if @current_user.name.blank? && clerk_name.present?

    if updates.any?
      @current_user.update!(updates)
    end
  rescue ActiveRecord::RecordInvalid => e
    render_unauthorized("Failed to authenticate: #{e.message}")
  end

  # Alias for backwards compatibility
  def current_admin
    @current_user
  end

  def current_user
    @current_user
  end

  def render_unauthorized(message = 'Unauthorized')
    render json: { error: message }, status: :unauthorized
  end

  def require_super_admin!
    unless current_user&.super_admin?
      render json: { error: 'Forbidden: Super admin access required' }, status: :forbidden
    end
  end

  def require_org_admin!(organization = nil)
    org = organization || Current.organization
    unless current_user&.org_admin_for?(org)
      render json: { error: 'Forbidden: Organization admin access required' }, status: :forbidden
    end
  end

  def require_tournament_admin!(tournament)
    unless current_user&.can_manage?(tournament)
      render json: { error: 'Forbidden: Tournament admin access required' }, status: :forbidden
    end
  end
end
