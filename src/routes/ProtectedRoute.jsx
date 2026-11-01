import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";
import { getMe } from "../services/auth.api";

export default function ProtectedRoute({ children }) {
  const token = getToken();
  const [isValid, setIsValid] = useState(() => {
    if (!token) return false;
    return null;
  });

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    getMe()
      .then(() => {
        if (mounted) setIsValid(true);
      })
      .catch(() => {
        if (mounted) setIsValid(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  if (isValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
