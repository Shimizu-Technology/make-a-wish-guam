class RaffleChannel < ApplicationCable::Channel
  def subscribed
    tournament = Tournament.find_by(id: params[:tournament_id])

    return reject unless tournament&.public_listed?
    return reject if tournament.draft? || tournament.archived?

    stream_from "tournament_#{tournament.id}_raffle"
  end
end
