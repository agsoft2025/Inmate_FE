import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // 🔁 restore login from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token) {
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          // if user in storage is corrupted
          setUser({ role: "user" });
        }
      } else {
        // token exists but user not stored
        setUser({ role: "user" });
      }
    }

    setBooting(false);
  }, []);

  const login = (payload) => {
    const nextUser = payload?.user ?? payload ?? { role: "user" };
    
    setUser(nextUser);

    if (payload?.token) {
      localStorage.setItem("token", payload.token);
    }
    // store user even if token exists but user is present
    localStorage.setItem("user", JSON.stringify(nextUser));
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.clear();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isAuth: !!localStorage.getItem("token"), // ✅ token is source of truth
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
