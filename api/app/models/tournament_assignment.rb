# frozen_string_literal: true

class TournamentAssignment < ApplicationRecord
  belongs_to :user
  belongs_to :tournament

  validates :user_id, uniqueness: { scope: :tournament_id, message: 'is already assigned to this tournament' }
end
