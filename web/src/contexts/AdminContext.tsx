import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Admin } from '../services/api';

interface AdminContextValue {
  currentAdmin: Admin | null;
  setCurrentAdmin: (admin: Admin | null) => void;
  isVolunteer: boolean;
  isAdmin: boolean;
}

const AdminContext = createContext<AdminContextValue>({
  currentAdmin: null,
  setCurrentAdmin: () => {},
  isVolunteer: false,
  isAdmin: false,
});

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

  const isVolunteer = currentAdmin?.org_role === 'volunteer';
  const isAdmin = !isVolunteer && currentAdmin != null;

  const handleSet = useCallback((admin: Admin | null) => {
    setCurrentAdmin(admin);
  }, []);

  return (
    <AdminContext.Provider value={{ currentAdmin, setCurrentAdmin: handleSet, isVolunteer, isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};
