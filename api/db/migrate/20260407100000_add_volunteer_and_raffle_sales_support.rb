# frozen_string_literal: true

class AddVolunteerAndRaffleSalesSupport < ActiveRecord::Migration[8.1]
  def change
    add_column :raffle_tickets, :sold_by_user_id, :bigint
    add_index :raffle_tickets, :sold_by_user_id
  end
end
