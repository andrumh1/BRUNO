import React from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * ProtectedRoute - Wrapper component for routes that require authentication
 * Handles loading state and redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Pantalla de carga mientras se restaura/renueva la sesión: nunca al login por un arranque lento o sin red
  if (isLoading) {
    return (
      <BrunoLoader message="Iniciando BRUNO…" />
    );
  }

  // Redirect to login only when there is really no session
  if (!isAuthenticated) {
    // Save the attempted URL for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render the protected content
  return children;
};

export default ProtectedRoute;
