import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ redirectTo = "/login" }) {
  const { isAuth, booting } = useAuth();
  if (booting) return null;
  return isAuth ? <Outlet /> : <Navigate to={redirectTo} replace />;
}
