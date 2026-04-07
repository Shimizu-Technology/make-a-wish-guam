import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../contexts';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export const AdminOnlyRoute: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { isVolunteer } = useAdmin();

  if (isVolunteer) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};
