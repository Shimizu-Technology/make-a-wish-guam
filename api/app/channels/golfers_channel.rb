class GolfersChannel < ApplicationCable::Channel
  def subscribed
    return reject unless current_admin.is_a?(User)

    tournament_ids = current_admin.accessible_tournaments.pluck(:id)
    return reject if tournament_ids.empty?

    tournament_ids.each do |tournament_id|
      stream_from "golfers_channel_#{tournament_id}"
    end
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end

