class AdminSerializer < ActiveModel::Serializer
  attributes :id, :clerk_id, :name, :email, :role, :created_at, :updated_at,
             :is_super_admin

  def is_super_admin
    object.super_admin?
  end
end

