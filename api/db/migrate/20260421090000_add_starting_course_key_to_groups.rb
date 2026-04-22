class AddStartingCourseKeyToGroups < ActiveRecord::Migration[8.1]
  def up
    add_column :groups, :starting_course_key, :string
    add_index :groups, [:tournament_id, :starting_course_key, :hole_number], name: "index_groups_on_tournament_course_and_hole"

    execute <<~SQL
      UPDATE groups
      SET starting_course_key = 'course-1'
      WHERE hole_number IS NOT NULL AND starting_course_key IS NULL
    SQL
  end

  def down
    remove_index :groups, name: "index_groups_on_tournament_course_and_hole"
    remove_column :groups, :starting_course_key
  end
end
