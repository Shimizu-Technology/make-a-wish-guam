# frozen_string_literal: true

module Api
  module V1
    class AdminsController < BaseController
      # Manages users (for backwards compatibility with "admins" endpoint)
      # All org admins can manage users within their organization
      before_action :set_organization_scope
      before_action :set_scoped_user, only: [:show, :update, :destroy]

      # GET /api/v1/admins
      def index
        users = @organization_scope.users.order(:created_at)
        render json: users, each_serializer: AdminSerializer
      end

      # GET /api/v1/admins/me
      def me
        render json: current_user, serializer: AdminSerializer
      end

      # GET /api/v1/admins/:id
      def show
        render json: @scoped_user, serializer: AdminSerializer
      end

      # POST /api/v1/admins
      # Add a new user by email (they'll be linked when they first log in)
      def create
        email = params.dig(:admin, :email)&.downcase&.strip

        if email.blank?
          render json: { errors: ['Email is required'] }, status: :unprocessable_entity
          return
        end

        user = nil

        begin
          user = User.find_by('LOWER(email) = ?', email)
          if user
            membership = @organization_scope.organization_memberships.find_by(user: user)
            if membership
              render json: { errors: ['A user with this email already exists in this organization'] }, status: :unprocessable_entity
              return
            end

            ActiveRecord::Base.transaction do
              @organization_scope.add_admin(user)
              user.update!(role: 'org_admin') unless user.super_admin?
            end
          else
            user = User.new(
              email: email,
              name: params.dig(:admin, :name),
              role: 'org_admin'
            )

            ActiveRecord::Base.transaction do
              user.save!
              @organization_scope.add_admin(user)
            end
          end
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages.presence || [e.message] }, status: :unprocessable_entity
          return
        end

        ActivityLog.log(
          admin: current_user,
          action: 'admin_created',
          target: user,
          details: "Added new user: #{user.email}"
        )
        render json: user, serializer: AdminSerializer, status: :created
      end

      # PATCH /api/v1/admins/:id
      def update
        if @scoped_user.update(user_update_params)
          render json: @scoped_user, serializer: AdminSerializer
        else
          render json: { errors: @scoped_user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/admins/:id
      def destroy
        membership = @organization_scope.organization_memberships.find_by!(user: @scoped_user)

        # Prevent deleting the last admin in the organization
        if membership.admin? && @organization_scope.organization_memberships.admins.count <= 1
          render json: { error: 'Cannot remove the last admin from this organization' }, status: :unprocessable_entity
          return
        end

        # Prevent self-deletion
        if @scoped_user.id == current_user.id
          render json: { error: 'Cannot delete yourself' }, status: :unprocessable_entity
          return
        end

        user_email = @scoped_user.email

        ActiveRecord::Base.transaction do
          membership.destroy!

          if @scoped_user.organization_memberships.reload.empty? && !@scoped_user.super_admin?
            @scoped_user.destroy!
          end
        end

        ActivityLog.log(
          admin: current_user,
          action: 'admin_deleted',
          target: nil,
          details: "Removed user: #{user_email}",
          metadata: { deleted_email: user_email }
        )

        head :no_content
      end

      private

      def user_update_params
        params.require(:admin).permit(:name, :email)
      end

      def set_organization_scope
        @organization_scope = current_user.accessible_organizations.first
        unless @organization_scope
          render json: { error: 'No accessible organization found' }, status: :forbidden
          return
        end

        require_org_admin!(@organization_scope)
      end

      def set_scoped_user
        @scoped_user = @organization_scope.users.find(params[:id])
      end
    end
  end
end
