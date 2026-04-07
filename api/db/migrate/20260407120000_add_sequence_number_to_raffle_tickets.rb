# frozen_string_literal: true

class AddSequenceNumberToRaffleTickets < ActiveRecord::Migration[8.0]
  def up
    add_column :raffle_tickets, :sequence_number, :integer

    # Backfill existing tickets with sequential numbers per tournament
    execute <<~SQL
      WITH numbered AS (
        SELECT id, tournament_id,
               ROW_NUMBER() OVER (PARTITION BY tournament_id ORDER BY created_at, id) AS seq
        FROM raffle_tickets
      )
      UPDATE raffle_tickets
      SET sequence_number = numbered.seq
      FROM numbered
      WHERE raffle_tickets.id = numbered.id
    SQL

    # Regenerate ticket numbers in the new format for existing tickets
    RaffleTicket.find_each do |ticket|
      org = ticket.tournament&.organization
      prefix = if org
        initials = org.name.scan(/[A-Z]/).first(4).join
        initials.presence || org.slug&.first(3)&.upcase || 'TIX'
      else
        'TIX'
      end
      new_number = "#{prefix}-#{ticket.sequence_number.to_s.rjust(4, '0')}"
      ticket.update_column(:ticket_number, new_number)
    end

    add_index :raffle_tickets, [:tournament_id, :sequence_number], unique: true
  end

  def down
    remove_index :raffle_tickets, [:tournament_id, :sequence_number]
    remove_column :raffle_tickets, :sequence_number
  end
end
