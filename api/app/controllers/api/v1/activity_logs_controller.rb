module Api
  module V1
    class ActivityLogsController < BaseController
      # GET /api/v1/activity_logs
      def index
        logs = ActivityLog.recent.includes(:user, :tournament)

        # Filter by tournament
        if params[:tournament_id].present?
          logs = logs.for_tournament(params[:tournament_id])
        elsif params[:all_tournaments] != 'true'
          # Default to current tournament
          tournament = Tournament.current
          logs = logs.for_tournament(tournament&.id) if tournament
        end

        # Filter by admin
        if params[:admin_id].present?
          logs = logs.by_admin(params[:admin_id])
        end

        # Filter by action
        if params[:action_type].present?
          logs = logs.by_action(params[:action_type])
        end

        # Filter by target
        if params[:target_type].present? && params[:target_id].present?
          logs = logs.by_target(params[:target_type], params[:target_id])
        end

        # Filter by date range
        if params[:start_date].present?
          logs = logs.where('created_at >= ?', Date.parse(params[:start_date]).beginning_of_day)
        end
        if params[:end_date].present?
          logs = logs.where('created_at <= ?', Date.parse(params[:end_date]).end_of_day)
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 100)
        
        total = logs.count
        logs = logs.offset((page - 1) * per_page).limit(per_page)

        render json: {
          activity_logs: ActiveModelSerializers::SerializableResource.new(logs),
          meta: {
            current_page: page,
            per_page: per_page,
            total_count: total,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/activity_logs/golfer/:golfer_id
      # Get activity logs for a specific golfer
      def golfer_history
        golfer = Golfer.find(params[:golfer_id])
        logs = ActivityLog
          .where(target_type: 'Golfer', target_id: golfer.id)
          .or(ActivityLog.where("metadata->>'golfer_name' = ?", golfer.name))
          .recent
          .includes(:user)
          .limit(20)

        render json: {
          activity_logs: ActiveModelSerializers::SerializableResource.new(logs),
          golfer_id: golfer.id,
          golfer_name: golfer.name
        }
      end

      # GET /api/v1/activity_logs/summary
      def summary
        tournament = if params[:tournament_id].present?
          Tournament.find(params[:tournament_id])
        else
          Tournament.current
        end

        base_scope = tournament ? ActivityLog.for_tournament(tournament.id) : ActivityLog

        today_count = base_scope.today.count
        
        # Activity by action type
        by_action = base_scope.group(:action).count
        
        # Activity by admin (top 10)
        by_admin = base_scope
          .joins(:user)
          .group('users.name')
          .order('count_all DESC')
          .limit(10)
          .count

        # Recent activity (last 7 days by day)
        seven_days_ago = 7.days.ago.beginning_of_day
        daily_activity = base_scope
          .where('created_at >= ?', seven_days_ago)
          .group("DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Guam')")
          .count

        render json: {
          tournament_id: tournament&.id,
          tournament_name: tournament&.name,
          today_count: today_count,
          total_count: base_scope.count,
          by_action: by_action,
          by_admin: by_admin,
          daily_activity: daily_activity
        }
      end
    end
  end
end
