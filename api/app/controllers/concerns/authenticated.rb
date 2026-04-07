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

    clerk_id = decoded['sub']
    email = decoded['email'] || decoded['primary_email_address']
    clerk_name = decoded['name'] ||
                 [decoded['first_name'], decoded['last_name']].compact.join(' ').presence

    unless clerk_id
      render_unauthorized('Invalid token payload')
      return
    end

    # When the default session token omits email, resolve it via the
    # Clerk Backend API (same pattern used in Marianas Open / GIAA).
    if email.blank? && clerk_id.present?
      clerk_user = fetch_clerk_user(clerk_id)
      if clerk_user
        email = clerk_user[:email]
        clerk_name ||= [clerk_user[:first_name], clerk_user[:last_name]].compact.join(' ').presence
      end
    end

    @current_user = User.find_by(clerk_id: clerk_id)

    if @current_user.nil? && email.present?
      @current_user = User.find_by('LOWER(email) = ?', email.downcase)
    end

    unless @current_user
      render_unauthorized('Access denied. You are not authorized. Please contact an administrator.')
      return
    end

    # Set Current context
    Current.user = @current_user

    # Link real Clerk ID and sync name on first successful auth
    updates = {}
    if @current_user.clerk_id.nil? || @current_user.clerk_id.start_with?('pending_')
      updates[:clerk_id] = clerk_id
    end
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

  # Allows admins AND volunteers (for check-in / raffle sales)
  def require_volunteer_or_admin!(organization = nil)
    org = organization || Current.organization
    return if current_user&.super_admin?
    return if current_user&.org_admin_for?(org)
    return if current_user&.volunteer_for?(org)

    render json: { error: 'Forbidden: You do not have access to this feature' }, status: :forbidden
  end

  # Resolve user details via the Clerk Backend API when the session
  # token doesn't include email (same approach as Marianas Open / GIAA).
  def fetch_clerk_user(clerk_id)
    secret = ENV['CLERK_SECRET_KEY']
    return nil if secret.blank?

    uri = URI("https://api.clerk.com/v1/users/#{clerk_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 5

    request = Net::HTTP::Get.new(uri.request_uri)
    request['Authorization'] = "Bearer #{secret}"

    response = http.request(request)
    return nil unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    primary_email_id = data['primary_email_address_id']
    email = data['email_addresses']&.find { |e| e['id'] == primary_email_id }&.dig('email_address')

    {
      email: email,
      first_name: data['first_name'],
      last_name: data['last_name']
    }
  rescue StandardError => e
    Rails.logger.warn("Failed to fetch Clerk user #{clerk_id}: #{e.message}")
    nil
  end
end
