class GroupsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "groups_channel"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end

