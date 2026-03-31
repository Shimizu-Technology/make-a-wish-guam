# frozen_string_literal: true

module Api
  module V1
    class ScoresController < BaseController
      include GolferOrAdminAuth

      # Skip default admin auth - we use dual auth for most endpoints
      skip_before_action :authenticate_user!
      
      before_action :set_tournament
      before_action :set_score, only: [:update, :destroy, :verify]
      
      # Public endpoints (no auth)
      # Auth required endpoints use authenticate_golfer_or_admin!
      before_action :authenticate_golfer_or_admin!, only: [:create, :update, :destroy, :verify, :batch, :scorecard]
      before_action :verify_group_access_for_golfer!, only: [:batch, :scorecard]
      before_action :verify_golfer_owns_score!, only: [:update, :destroy, :verify]

      # GET /api/v1/tournaments/:tournament_id/scores
      # Public - get all scores for a tournament
      def index
        scores = @tournament.scores.includes(:golfer, :group)

        # Filter by group
        scores = scores.where(group_id: params[:group_id]) if params[:group_id].present?
        
        # Filter by golfer
        scores = scores.where(golfer_id: params[:golfer_id]) if params[:golfer_id].present?
        
        # Filter by hole
        scores = scores.where(hole: params[:hole]) if params[:hole].present?

        render json: {
          scores: scores.order(:group_id, :hole).map { |s| score_response(s) }
        }
      end

      # GET /api/v1/tournaments/:tournament_id/scores/leaderboard
      # Public - get leaderboard data
      def leaderboard
        # Determine scoring type from tournament
        is_team_scoring = @tournament.tournament_format == 'scramble'

        if is_team_scoring
          leaderboard_data = team_leaderboard
        else
          leaderboard_data = individual_leaderboard
        end

        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            format: @tournament.tournament_format,
            total_holes: @tournament.total_holes || 18,
            total_par: @tournament.total_par || 72
          },
          scoring_type: is_team_scoring ? 'team' : 'individual',
          leaderboard: leaderboard_data,
          last_updated: Time.current.iso8601
        }
      end

      # POST /api/v1/tournaments/:tournament_id/scores
      # Auth required (admin or golfer) - create a score
      def create
        @score = @tournament.scores.build(score_params)
        @score.entered_by = score_entered_by

        # Auto-set group from golfer if not provided
        if @score.group_id.blank? && @score.golfer_id.present?
          golfer = Golfer.find_by(id: @score.golfer_id)
          @score.group = golfer&.group
        end

        if @score.save
          render json: {
            score: score_response(@score),
            message: 'Score recorded successfully'
          }, status: :created
        else
          render json: { error: @score.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/tournaments/:tournament_id/scores/:id
      # Auth required - update a score
      def update
        if @score.update(score_params)
          render json: {
            score: score_response(@score),
            message: 'Score updated successfully'
          }
        else
          render json: { error: @score.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/tournaments/:tournament_id/scores/:id
      # Auth required - delete a score
      def destroy
        @score.destroy
        render json: { message: 'Score deleted' }
      end

      # POST /api/v1/tournaments/:tournament_id/scores/:id/verify
      # Auth required - verify a score
      def verify
        verifier = admin_authenticated? ? current_user : @current_golfer
        @score.verify!(verifier)
        render json: {
          score: score_response(@score),
          message: 'Score verified'
        }
      end

      # POST /api/v1/tournaments/:tournament_id/scores/batch
      # Auth required (admin or golfer) - create multiple scores at once (for full scorecard submission)
      def batch
        scores_data = params[:scores] || []
        created_scores = []
        errors = []

        ActiveRecord::Base.transaction do
          scores_data.each do |score_data|
            score = @tournament.scores.build(
              hole: score_data[:hole],
              strokes: score_data[:strokes],
              golfer_id: score_data[:golfer_id],
              group_id: score_data[:group_id],
              score_type: score_data[:score_type] || 'individual',
              entered_by: score_entered_by
            )

            # Auto-set group from golfer if not provided
            if score.group_id.blank? && score.golfer_id.present?
              golfer = Golfer.find_by(id: score.golfer_id)
              score.group = golfer&.group
            end

            # Validate golfer belongs to the group (prevent cross-group score injection)
            if golfer_authenticated? && score_data[:golfer_id].present?
              target_golfer = Golfer.find_by(id: score_data[:golfer_id])
              unless target_golfer&.group_id == score.group_id
                errors << { hole: score_data[:hole], errors: ['Golfer not in this group'] }
                next
              end
            end

            if score.save
              created_scores << score
            else
              errors << { hole: score_data[:hole], errors: score.errors.full_messages }
            end
          end

          # Rollback if any errors
          raise ActiveRecord::Rollback if errors.any?
        end

        if errors.empty?
          render json: {
            scores: created_scores.map { |s| score_response(s) },
            message: "#{created_scores.count} scores recorded"
          }, status: :created
        else
          render json: { errors: errors }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/tournaments/:tournament_id/scores/scorecard
      # Auth required - get scorecard for a group
      def scorecard
        group = @tournament.groups.find(params[:group_id])
        golfers = group.golfers.includes(:scores)
        is_team_scoring = @tournament.tournament_format == 'scramble'

        # Get team scores for this group (for scramble format)
        team_scores_by_hole = {}
        if is_team_scoring
          @tournament.scores
            .where(group: group, score_type: 'team')
            .each { |s| team_scores_by_hole[s.hole] = s }
        end

        # Get individual scores for this group
        scores_by_golfer = {}
        group.golfers.each do |golfer|
          scores_by_golfer[golfer.id] = golfer.scores
            .where(tournament: @tournament)
            .index_by(&:hole)
        end

        # Build hole-by-hole scorecard
        holes = (1..(@tournament.total_holes || 18)).map do |hole_num|
          hole_par = (@tournament.hole_pars || {})[hole_num.to_s]&.to_i || 4
          
          hole_data = {
            hole: hole_num,
            par: hole_par,
            scores: golfers.map do |golfer|
              score = scores_by_golfer[golfer.id]&.[](hole_num)
              {
                golfer_id: golfer.id,
                golfer_name: golfer.name,
                strokes: score&.strokes,
                relative: score&.relative_score
              }
            end
          }

          # Add team score if scramble format
          if is_team_scoring
            team_score = team_scores_by_hole[hole_num]
            hole_data[:team_score] = team_score ? {
              strokes: team_score.strokes,
              relative: team_score.relative_score
            } : nil
          end

          hole_data
        end

        # Build totals
        if is_team_scoring
          team_scores = team_scores_by_hole.values
          team_totals = {
            team_name: golfers.map(&:name).join(' & '),
            total_strokes: team_scores.sum(&:strokes),
            total_relative: team_scores.sum { |s| s.relative_score || 0 },
            holes_completed: team_scores.count
          }
        end

        render json: {
          tournament: {
            id: @tournament.id,
            name: @tournament.name,
            tournament_format: @tournament.tournament_format,
            team_size: @tournament.team_size,
            total_holes: @tournament.total_holes || 18,
            total_par: @tournament.total_par || 72
          },
          group: {
            id: group.id,
            group_number: group.group_number,
            hole_position: group.hole_position_label
          },
          golfers: golfers.map { |g| { id: g.id, name: g.name } },
          holes: holes,
          is_team_scoring: is_team_scoring,
          team_totals: is_team_scoring ? team_totals : nil,
          totals: golfers.map do |golfer|
            scores = scores_by_golfer[golfer.id]&.values || []
            {
              golfer_id: golfer.id,
              golfer_name: golfer.name,
              total_strokes: scores.sum(&:strokes),
              total_relative: scores.sum { |s| s.relative_score || 0 },
              holes_completed: scores.count
            }
          end
        }
      end

      private

      # Verify golfer can only access their own group
      def verify_group_access_for_golfer!
        return true if admin_authenticated?
        
        if golfer_authenticated?
          group_id = params[:group_id]&.to_i || params.dig(:scores, 0, :group_id)&.to_i
          
          if group_id && current_golfer.group_id != group_id
            render json: { 
              success: false, 
              error: 'You can only enter scores for your own group' 
            }, status: :forbidden
            return false
          end
        end
        
        true
      end

      # Verify golfer can only modify scores from their own group
      def verify_golfer_owns_score!
        return true if admin_authenticated?

        if golfer_authenticated? && @score.group_id != current_golfer.group_id
          render json: {
            success: false,
            error: 'You can only modify scores for your own group'
          }, status: :forbidden
          return false
        end

        true
      end

      # Get the user/golfer who entered the score
      def score_entered_by
        admin_authenticated? ? current_user : nil
      end

      def set_tournament
        @tournament = Tournament.find(params[:tournament_id])
      end

      def set_score
        @score = @tournament.scores.find(params[:id])
      end

      def score_params
        params.require(:score).permit(
          :hole, :strokes, :golfer_id, :group_id, :score_type, :notes
        )
      end

      def score_response(score)
        {
          id: score.id,
          hole: score.hole,
          strokes: score.strokes,
          par: score.par,
          relative_score: score.relative_score,
          relative_name: score.relative_score_name,
          score_type: score.score_type,
          verified: score.verified,
          golfer: score.golfer ? { id: score.golfer.id, name: score.golfer.name } : nil,
          group: { id: score.group.id, group_number: score.group.group_number },
          entered_at: score.created_at.iso8601
        }
      end

      def individual_leaderboard
        golfers = @tournament.golfers.confirmed.includes(:group).to_a
        scores_by_golfer = @tournament.scores
                                   .where(score_type: 'individual')
                                   .select(:golfer_id, :strokes, :relative_score)
                                   .group_by(&:golfer_id)

        golfers_with_scores = golfers.map do |golfer|
          scores = scores_by_golfer[golfer.id] || []
          total_strokes = scores.sum(&:strokes)
          total_relative = scores.sum { |s| s.relative_score || 0 }
          holes_completed = scores.count

          {
            golfer_id: golfer.id,
            name: golfer.name,
            group_number: golfer.group&.group_number,
            total_strokes: total_strokes,
            total_relative: total_relative,
            holes_completed: holes_completed,
            thru: holes_completed,
            display_score: format_relative_score(total_relative),
            checked_in: golfer.checked_in_at.present?
          }
        end

        # Sort by relative score (ascending), then by holes completed (descending)
        golfers_with_scores
          .select { |g| g[:holes_completed] > 0 }
          .sort_by { |g| [g[:total_relative], -g[:holes_completed]] }
          .each_with_index.map { |g, i| g.merge(position: i + 1) }
      end

      def team_leaderboard
        groups = @tournament.groups.includes(:golfers).to_a
        all_scores = @tournament.scores.select(:group_id, :hole, :strokes, :relative_score, :score_type).to_a
        team_scores_by_group = all_scores.select { |s| s.score_type == 'team' }.group_by(&:group_id)
        individual_scores_by_group_hole = all_scores
                                          .select { |s| s.score_type == 'individual' }
                                          .group_by { |s| [s.group_id, s.hole] }

        groups_with_scores = groups.map do |group|
          team_scores = team_scores_by_group[group.id] || []

          if team_scores.any?
            total_strokes = team_scores.sum(&:strokes)
            total_relative = team_scores.sum { |s| s.relative_score || 0 }
            holes_completed = team_scores.count
          else
            # Fallback: use best ball from individuals
            holes_completed = 0
            total_strokes = 0
            total_relative = 0

            (1..(@tournament.total_holes || 18)).each do |hole|
              hole_scores = individual_scores_by_group_hole[[group.id, hole]] || []
              next if hole_scores.empty?

              best = hole_scores.min_by(&:strokes)
              total_strokes += best.strokes
              total_relative += best.relative_score || 0
              holes_completed += 1
            end
          end

          {
            group_id: group.id,
            group_number: group.group_number,
            team_name: group.golfers.map(&:name).join(' / '),
            golfers: group.golfers.map { |g| { id: g.id, name: g.name } },
            total_strokes: total_strokes,
            total_relative: total_relative,
            holes_completed: holes_completed,
            thru: holes_completed,
            display_score: format_relative_score(total_relative)
          }
        end

        # Sort by relative score
        groups_with_scores
          .select { |g| g[:holes_completed] > 0 }
          .sort_by { |g| [g[:total_relative], -g[:holes_completed]] }
          .each_with_index.map { |g, i| g.merge(position: i + 1) }
      end

      def format_relative_score(score)
        return 'E' if score == 0
        return nil if score.nil?
        score > 0 ? "+#{score}" : score.to_s
      end
    end
  end
end
