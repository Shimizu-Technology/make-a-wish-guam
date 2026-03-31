class EnforceOrganizationOnTournaments < ActiveRecord::Migration[8.1]
  class MigrationTournament < ActiveRecord::Base
    self.table_name = "tournaments"
  end

  class MigrationOrganization < ActiveRecord::Base
    self.table_name = "organizations"
  end

  def up
    backfill_missing_organizations!
    change_column_null :tournaments, :organization_id, false
  end

  def down
    change_column_null :tournaments, :organization_id, true
  end

  private

  def backfill_missing_organizations!
    return unless MigrationTournament.where(organization_id: nil).exists?

    fallback_org = MigrationOrganization.find_or_create_by!(slug: "legacy-unassigned") do |org|
      org.name = "Legacy Unassigned"
      org.subscription_status = "active"
      org.primary_color = "#16a34a"
    end

    MigrationTournament.where(organization_id: nil).update_all(
      organization_id: fallback_org.id,
      updated_at: Time.current
    )
  end
end
