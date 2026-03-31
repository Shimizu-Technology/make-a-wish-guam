class AddTournamentConfigToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :tournament_year, :string, default: "2026"
    add_column :settings, :tournament_edition, :string, default: "5th"
    add_column :settings, :tournament_title, :string, default: "AIRPORT WEEK"
    add_column :settings, :tournament_name, :string, default: "Edward A.P. Muna II Memorial Golf Tournament"
    add_column :settings, :event_date, :string, default: "January 9, 2026"
    add_column :settings, :registration_time, :string, default: "11:00 am"
    add_column :settings, :start_time, :string, default: "12:30 pm"
    add_column :settings, :location_name, :string, default: "Country Club of the Pacific"
    add_column :settings, :location_address, :string, default: "Windward Hills, Guam"
    add_column :settings, :format_name, :string, default: "Individual Callaway"
    add_column :settings, :fee_includes, :string, default: "Green Fee, Ditty Bag, Drinks & Food"
    add_column :settings, :checks_payable_to, :string, default: "GIAAEO"
    add_column :settings, :contact_name, :string, default: "Peter Torres"
    add_column :settings, :contact_phone, :string, default: "671.689.8677"
  end
end
