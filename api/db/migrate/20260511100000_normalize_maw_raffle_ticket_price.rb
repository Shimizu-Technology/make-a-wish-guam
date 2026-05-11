# frozen_string_literal: true

class NormalizeMawRaffleTicketPrice < ActiveRecord::Migration[8.1]
  DEFAULT_BUNDLES = [
    { 'quantity' => 4, 'price_cents' => 2000, 'label' => '$20 for 4 tickets' },
    { 'quantity' => 12, 'price_cents' => 5000, 'label' => '$50 for 12 tickets' },
    { 'quantity' => 25, 'price_cents' => 10_000, 'label' => '$100 for 25 tickets' }
  ].freeze

  def up
    Tournament.reset_column_information
    Tournament.find_each do |tournament|
      next unless tournament.raffle_ticket_price_cents == 1000
      next unless tournament.config.blank? ||
                  tournament.config['raffle_bundles'].blank? ||
                  tournament.config['raffle_bundles'] == DEFAULT_BUNDLES

      tournament.update_columns(raffle_ticket_price_cents: 500, updated_at: Time.current)
    end
  end

  def down
    # No-op: this normalizes stale MAW/default raffle pricing to the documented $5 ticket price.
  end
end
