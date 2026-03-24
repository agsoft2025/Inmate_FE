import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const normalizeRole = (r) => String(r || "").toUpperCase();

const getDefaultRouteByRole = (role) => {
  switch (normalizeRole(role)) {
    case "POS":
      return "/tuck-shop-pos";
    case "INMATE":
      return "/inmate-profile";
    case "SUPER ADMIN":
    case "ADMIN":
      return "/dashboard";
    default:
      return "/login";
  }
};

export default function RoleRoute({ allow = [] }) {
  const { user, booting } = useAuth();

  if (booting) return null;

  const role = normalizeRole(user?.role);

  // not logged in role fallback
  if (!role) return <Navigate to="/login" replace />;

  const allowed = allow.map(normalizeRole).includes(role);
  if (!allowed) {
    return <Navigate to={getDefaultRouteByRole(role)} replace />;
  }

  return <Outlet />;
}
