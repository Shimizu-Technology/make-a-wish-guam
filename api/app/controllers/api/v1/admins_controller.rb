# frozen_string_literal: true

module Api
  module V1
    class AdminsController < BaseController
      # Manages users (for backwards compatibility with "admins" endpoint)
      # All org admins can manage users within their organization

      # GET /api/v1/admins
      def index
        users = current_user.accessible_organizations.first&.users || User.none
        users = users.order(:created_at)
        render json: users, each_serializer: AdminSerializer
      end

      # GET /api/v1/admins/me
      def me
        render json: current_user, serializer: AdminSerializer
      end

      # GET /api/v1/admins/:id
      def show
        user = User.find(params[:id])
        render json: user, serializer: AdminSerializer
      end

      # POST /api/v1/admins
      # Add a new user by email (they'll be linked when they first log in)
      def create
        email = params.dig(:admin, :email)&.downcase&.strip

        if email.blank?
          render json: { errors: ['Email is required'] }, status: :unprocessable_entity
          return
        end

        # Check if user already exists
        if User.exists?(['LOWER(email) = ?', email])
          render json: { errors: ['A user with this email already exists'] }, status: :unprocessable_entity
          return
        end

        user = User.new(
          email: email,
          name: params.dig(:admin, :name),
          role: 'org_admin'
        )

        if user.save
          # Add to first organization
          org = current_user.accessible_organizations.first
          org&.add_admin(user)

          ActivityLog.log(
            admin: current_user,
            action: 'admin_created',
            target: user,
            details: "Added new user: #{user.email}"
          )
          render json: user, serializer: AdminSerializer, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/admins/:id
      def update
        user = User.find(params[:id])

        if user.update(user_update_params)
          render json: user, serializer: AdminSerializer
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/admins/:id
      def destroy
        user = User.find(params[:id])

        # Prevent deleting the last user
        if User.count <= 1
          render json: { error: 'Cannot delete the last user' }, status: :unprocessable_entity
          return
        end

        # Prevent self-deletion
        if user.id == current_user.id
          render json: { error: 'Cannot delete yourself' }, status: :unprocessable_entity
          return
        end

        user_email = user.email
        user.destroy

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
    end
  end
end
