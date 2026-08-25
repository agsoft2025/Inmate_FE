import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deleteCookie } from "../utils/cookieUtils";
import { logoutService } from "../service/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // 🔁 restore login from localStorage.
  // The JWT itself is no longer stored/readable here - it lives in an
  // httpOnly cookie the backend set on login (see authController.js).
  // `user` is just a cached copy of the profile info from that login
  // response, kept so the UI doesn't flash "logged out" on a page refresh;
  // it is not itself proof of a valid session. If the underlying cookie is
  // actually missing/expired, the first authenticated API call gets a
  // 401/403 and lib/axios.js's response interceptor clears this and
  // redirects to /login.
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // if user in storage is corrupted
        setUser(null);
      }
    }

    setBooting(false);
  }, []);

  const login = (payload) => {
    const nextUser = payload?.user ?? payload ?? { role: "user" };

    setUser(nextUser);
    // No token to store: the backend sets it as an httpOnly cookie, which
    // is never present in this response body and never touches JS/storage.
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  const logout = async () => {
    const currentUserId = user?.id;
    try {
      // Clears the httpOnly auth cookie (and blacklists the token)
      // server-side - see authController.js's logout.
      await logoutService();
    } catch (error) {
      console.warn("Logout API failed", error);
    }
    localStorage.removeItem("user");
    localStorage.clear();
    deleteCookie("selectedLocation", currentUserId);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      // ✅ presence of the cached profile is the source of truth now that
      // the JWT itself is httpOnly and unreadable from JS (see the effect
      // above for how a stale/expired cookie still gets caught).
      isAuth: !!user,
      login,
      logout,
      booting,
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
