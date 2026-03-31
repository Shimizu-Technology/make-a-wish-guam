# frozen_string_literal: true

# Service to calculate tournament leaderboards
class LeaderboardCalculator
  attr_reader :tournament

  def initialize(tournament)
    @tournament = tournament
  end

  # Main entry point - returns appropriate leaderboard based on format
  def calculate
    case tournament.tournament_format
    when 'scramble'
      scramble_leaderboard
    when 'stroke', 'gross'
      stroke_play_leaderboard
    when 'stableford'
      stableford_leaderboard
    when 'best_ball'
      best_ball_leaderboard
    else
      stroke_play_leaderboard  # Default
    end
  end

  # Scramble format - team scores
  def scramble_leaderboard
    groups_with_scores.map do |group|
      scores = group.team_scores
      total_strokes = scores.sum(&:strokes)
      total_relative = scores.sum(&:relative_score)
      holes_played = scores.count
      
      {
        type: 'team',
        group_id: group.id,
        group_number: group.group_number,
        team_name: group.team_name || "Group #{group.group_number}",
        golfers: group.golfers.map { |g| { id: g.id, name: g.name } },
        total_strokes: total_strokes,
        relative_score: total_relative,
        holes_played: holes_played,
        thru: format_thru(holes_played),
        scores_by_hole: scores_by_hole(scores)
      }
    end.sort_by { |t| [t[:relative_score], t[:total_strokes]] }
       .each_with_index.map { |t, i| t.merge(position: i + 1) }
  end

  # Stroke play format - individual scores
  def stroke_play_leaderboard
    golfers_with_scores.map do |golfer|
      scores = golfer.scores.where(tournament: tournament, score_type: 'individual')
      total_strokes = scores.sum(:strokes)
      total_relative = scores.sum(:relative_score)
      holes_played = scores.count
      
      {
        type: 'individual',
        golfer_id: golfer.id,
        name: golfer.name,
        company: golfer.company,
        group_id: golfer.group_id,
        group_number: golfer.group&.group_number,
        total_strokes: total_strokes,
        relative_score: total_relative,
        holes_played: holes_played,
        thru: format_thru(holes_played),
        scores_by_hole: scores_by_hole(scores)
      }
    end.sort_by { |g| [g[:relative_score], g[:total_strokes]] }
       .each_with_index.map { |g, i| g.merge(position: i + 1) }
  end

  # Stableford format - points based system
  def stableford_leaderboard
    golfers_with_scores.map do |golfer|
      scores = golfer.scores.where(tournament: tournament, score_type: 'individual')
      total_points = scores.sum { |s| stableford_points(s.relative_score) }
      holes_played = scores.count
      
      {
        type: 'individual',
        golfer_id: golfer.id,
        name: golfer.name,
        company: golfer.company,
        group_id: golfer.group_id,
        group_number: golfer.group&.group_number,
        total_points: total_points,
        holes_played: holes_played,
        thru: format_thru(holes_played),
        scores_by_hole: scores_by_hole(scores, :stableford)
      }
    end.sort_by { |g| -g[:total_points] }  # Higher is better
       .each_with_index.map { |g, i| g.merge(position: i + 1) }
  end

  # Best ball format - team's best individual score per hole
  def best_ball_leaderboard
    groups_with_scores.map do |group|
      golfer_ids = group.golfers.pluck(:id)
      
      # Get best score per hole from team members
      best_scores = (1..18).map do |hole|
        hole_scores = Score.where(
          tournament: tournament,
          golfer_id: golfer_ids,
          hole: hole,
          score_type: 'individual'
        )
        hole_scores.order(:strokes).first
      end.compact
      
      total_strokes = best_scores.sum(&:strokes)
      total_relative = best_scores.sum(&:relative_score)
      holes_played = best_scores.count
      
      {
        type: 'team',
        group_id: group.id,
        group_number: group.group_number,
        team_name: group.team_name || "Group #{group.group_number}",
        golfers: group.golfers.map { |g| { id: g.id, name: g.name } },
        total_strokes: total_strokes,
        relative_score: total_relative,
        holes_played: holes_played,
        thru: format_thru(holes_played),
        scores_by_hole: best_scores_by_hole(best_scores)
      }
    end.sort_by { |t| [t[:relative_score], t[:total_strokes]] }
       .each_with_index.map { |t, i| t.merge(position: i + 1) }
  end

  # Get current leaders (top N)
  def leaders(limit = 10)
    calculate.first(limit)
  end

  # Get leaderboard for a specific group
  def group_scores(group)
    calculate.select { |entry| entry[:group_id] == group.id }
  end

  private

  def golfers_with_scores
    tournament.golfers.confirmed.includes(:scores, :group)
  end

  def groups_with_scores
    tournament.groups.includes(:golfers, :scores)
  end

  def scores_by_hole(scores, format = :stroke)
    scores.index_by(&:hole).transform_values do |score|
      if format == :stableford
        {
          strokes: score.strokes,
          points: stableford_points(score.relative_score),
          relative: score.relative_score
        }
      else
        {
          strokes: score.strokes,
          relative: score.relative_score
        }
      end
    end
  end

  def best_scores_by_hole(scores)
    scores.each_with_object({}) do |score, hash|
      hash[score.hole] = {
        strokes: score.strokes,
        relative: score.relative_score,
        golfer_id: score.golfer_id
      }
    end
  end

  def format_thru(holes)
    return 'F' if holes >= 18
    return '-' if holes == 0
    holes.to_s
  end

  # Stableford scoring
  def stableford_points(relative_score)
    return 0 unless relative_score
    
    case relative_score
    when ..-2 then 5  # Eagle or better
    when -1 then 4    # Birdie
    when 0 then 3     # Par
    when 1 then 2     # Bogey
    when 2 then 1     # Double bogey
    else 0            # Triple bogey or worse
    end
  end
end
