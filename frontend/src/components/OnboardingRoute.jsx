import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const OnboardingRoute = ({ children, requiredStage }) => {
  const location = useLocation();
  const sessionData = localStorage.getItem('clinician_auth_session');
  
  if (!sessionData) {
    return <Navigate to="/login" replace />;
  }

  try {
    const { token, onboardingStage } = JSON.parse(sessionData);
    
    if (!token) {
      return <Navigate to="/login" replace />;
    }

    // Route based on onboarding stage
    if (onboardingStage === 'PROFILE' && location.pathname !== '/setup-profile') {
      return <Navigate to="/setup-profile" replace />;
    }

    if (onboardingStage === 'TEAM' && location.pathname !== '/setup-team') {
      return <Navigate to="/setup-team" replace />;
    }

    if (onboardingStage === 'COMPLETED' && (location.pathname === '/setup-profile' || location.pathname === '/setup-team')) {
      return <Navigate to="/" replace />;
    }

    return children;
  } catch (error) {
    localStorage.removeItem('clinician_auth_session');
    return <Navigate to="/login" replace />;
  }
};

export default OnboardingRoute;