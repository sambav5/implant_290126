import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const sessionData = localStorage.getItem('clinician_auth_session');
  
  if (!sessionData) {
    return <Navigate to="/login" replace />;
  }

  try {
    const { token, exp } = JSON.parse(sessionData);
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (!token || (exp && exp < currentTime)) {
      localStorage.removeItem('clinician_auth_session');
      return <Navigate to="/login" replace />;
    }
  } catch (error) {
    localStorage.removeItem('clinician_auth_session');
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
