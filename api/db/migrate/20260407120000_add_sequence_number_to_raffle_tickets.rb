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

    # Regenerate ticket numbers with a prefix derived from the org name.
    # Only updates tickets that don't already match the PREFIX-NNNN format,
    # so tickets whose numbers were already emailed to buyers are preserved.
    execute <<~SQL
      UPDATE raffle_tickets
      SET ticket_number = sub.prefix || '-' || LPAD(raffle_tickets.sequence_number::text, 4, '0')
      FROM (
        SELECT t.id AS tournament_id,
               COALESCE(
                 NULLIF(LEFT(REGEXP_REPLACE(o.name, '[^A-Z]', '', 'g'), 4), ''),
                 UPPER(LEFT(o.slug, 3)),
                 'TIX'
               ) AS prefix
        FROM tournaments t
        JOIN organizations o ON o.id = t.organization_id
      ) sub
      WHERE raffle_tickets.tournament_id = sub.tournament_id
        AND raffle_tickets.ticket_number !~ ('^' || sub.prefix || '-\\d{4,}$')
    SQL

    add_index :raffle_tickets, [:tournament_id, :sequence_number], unique: true
  end

  def down
    remove_index :raffle_tickets, [:tournament_id, :sequence_number]
    remove_column :raffle_tickets, :sequence_number
  end
end
