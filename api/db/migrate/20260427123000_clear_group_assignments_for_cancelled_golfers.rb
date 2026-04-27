class ClearGroupAssignmentsForCancelledGolfers < ActiveRecord::Migration[8.1]
  class MigrationGolfer < ActiveRecord::Base
    self.table_name = "golfers"
  end

  def up
    MigrationGolfer.where(registration_status: "cancelled")
                   .where.not(group_id: nil)
                   .update_all(group_id: nil, position: nil, updated_at: Time.current)

    MigrationGolfer.where(registration_status: "cancelled")
                   .where(group_id: nil)
                   .where.not(position: nil)
                   .update_all(position: nil, updated_at: Time.current)
  end

  def down
    # Irreversible cleanup of stale group assignments for cancelled golfers.
  end
end
