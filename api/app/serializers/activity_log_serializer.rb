class ActivityLogSerializer < ActiveModel::Serializer
  attributes :id, :action, :target_type, :target_id, :target_name,
             :details, :metadata, :created_at, :admin_name, :admin_email

  def admin_name
    object.admin_display_name
  end

  def admin_email
    object.admin&.email
  end

  def created_at
    object.created_at.in_time_zone('Guam').iso8601
  end
end

