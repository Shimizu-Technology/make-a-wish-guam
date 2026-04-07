class AdminSerializer < ActiveModel::Serializer
  attributes :id, :clerk_id, :name, :email, :role, :created_at, :updated_at,
             :is_super_admin, :org_role

  def is_super_admin
    object.super_admin?
  end

  def org_role
    return 'admin' if object.super_admin?
    org = @instance_options[:scope_organization] || Current.organization || object.organizations.first
    return nil unless org
    object.organization_memberships.find_by(organization: org)&.role
  end
end

