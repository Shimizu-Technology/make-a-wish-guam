class MigrateExistingDataToDefaultTournament < ActiveRecord::Migration[8.1]
  def up
    # Get existing settings to create default tournament
    setting = execute("SELECT * FROM settings LIMIT 1").first
    
    if setting
      # Create default tournament from existing settings
      execute <<-SQL
        INSERT INTO tournaments (
          name, year, edition, status, event_date, registration_time, start_time,
          location_name, location_address, max_capacity, entry_fee, format_name,
          fee_includes, checks_payable_to, contact_name, contact_phone,
          registration_open, created_at, updated_at
        ) VALUES (
          '#{setting['tournament_name'] || 'Edward A.P. Muna II Memorial Golf Tournament'}',
          #{setting['tournament_year']&.to_i || 2026},
          '#{setting['tournament_edition'] || '5th'}',
          'open',
          '#{setting['event_date'] || 'January 9, 2026'}',
          '#{setting['registration_time'] || '11:00 am'}',
          '#{setting['start_time'] || '12:30 pm'}',
          '#{setting['location_name'] || 'Country Club of the Pacific'}',
          '#{setting['location_address'] || 'Windward Hills, Guam'}',
          #{setting['max_capacity'] || 160},
          #{setting['tournament_entry_fee'] || 12500},
          '#{setting['format_name'] || 'Individual Callaway'}',
          '#{setting['fee_includes'] || 'Green Fee, Ditty Bag, Drinks & Food'}',
          '#{setting['checks_payable_to'] || 'GIAAEO'}',
          '#{setting['contact_name'] || 'Peter Torres'}',
          '#{setting['contact_phone'] || '671.689.8677'}',
          #{setting['registration_open'] == true || setting['registration_open'] == 't' ? 'true' : 'false'},
          NOW(),
          NOW()
        )
      SQL
    else
      # Create a default tournament if no settings exist
      execute <<-SQL
        INSERT INTO tournaments (
          name, year, edition, status, event_date, registration_time, start_time,
          location_name, location_address, max_capacity, entry_fee, format_name,
          fee_includes, checks_payable_to, contact_name, contact_phone,
          registration_open, created_at, updated_at
        ) VALUES (
          'Edward A.P. Muna II Memorial Golf Tournament',
          2026,
          '5th',
          'open',
          'January 9, 2026',
          '11:00 am',
          '12:30 pm',
          'Country Club of the Pacific',
          'Windward Hills, Guam',
          160,
          12500,
          'Individual Callaway',
          'Green Fee, Ditty Bag, Drinks & Food',
          'GIAAEO',
          'Peter Torres',
          '671.689.8677',
          true,
          NOW(),
          NOW()
        )
      SQL
    end

    # Get the newly created tournament ID
    tournament_id = execute("SELECT id FROM tournaments ORDER BY id DESC LIMIT 1").first['id']

    # Assign all existing golfers to this tournament
    execute("UPDATE golfers SET tournament_id = #{tournament_id} WHERE tournament_id IS NULL")

    # Assign all existing groups to this tournament
    execute("UPDATE groups SET tournament_id = #{tournament_id} WHERE tournament_id IS NULL")

    # Assign all existing activity logs to this tournament
    execute("UPDATE activity_logs SET tournament_id = #{tournament_id} WHERE tournament_id IS NULL")

    # Now make tournament_id NOT NULL on golfers and groups (after data is migrated)
    change_column_null :golfers, :tournament_id, false
    change_column_null :groups, :tournament_id, false
  end

  def down
    # Remove tournament_id constraints
    change_column_null :golfers, :tournament_id, true
    change_column_null :groups, :tournament_id, true

    # Clear tournament associations
    execute("UPDATE golfers SET tournament_id = NULL")
    execute("UPDATE groups SET tournament_id = NULL")
    execute("UPDATE activity_logs SET tournament_id = NULL")

    # Delete all tournaments
    execute("DELETE FROM tournaments")
  end
end
