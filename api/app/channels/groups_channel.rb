class GroupsChannel < ApplicationCable::Channel
  def subscribed
    return reject unless current_admin.is_a?(User)

    stream_from "groups_channel"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
