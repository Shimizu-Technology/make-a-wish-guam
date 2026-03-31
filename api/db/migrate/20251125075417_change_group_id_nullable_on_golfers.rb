class ChangeGroupIdNullableOnGolfers < ActiveRecord::Migration[8.1]
  def change
    change_column_null :golfers, :group_id, true
  end
end
