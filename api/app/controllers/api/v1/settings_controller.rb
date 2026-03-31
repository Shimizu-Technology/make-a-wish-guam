module Api
  module V1
    class SettingsController < BaseController
      # GET /api/v1/settings
      # Returns global settings (shared across all tournaments)
      def show
        setting = Setting.instance
        render json: setting, serializer: SettingSerializer
      end

      # PATCH /api/v1/settings
      # Update global settings only
      def update
        setting = Setting.instance
        old_values = setting.attributes.slice(*setting_params.keys.map(&:to_s))

        if setting.update(setting_params)
          # Log the changes
          changes = setting_params.keys.select { |k| old_values[k.to_s] != setting.send(k) }
          
          if changes.any?
            ActivityLog.log(
              admin: current_admin,
              action: 'settings_updated',
              target: setting,
              details: "Updated global settings: #{changes.join(', ')}",
              metadata: {
                changed_fields: changes,
                previous_values: old_values.slice(*changes.map(&:to_s))
              }
            )
          end
          
          render json: setting, serializer: SettingSerializer
        else
          render json: { errors: setting.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def setting_params
        # Only global settings - tournament-specific settings are in Tournament model
        params.require(:setting).permit(
          :stripe_public_key,
          :stripe_secret_key,
          :stripe_webhook_secret,
          :payment_mode,
          :admin_email
        )
      end
    end
  end
end
