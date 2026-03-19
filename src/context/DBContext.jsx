import { createContext, useContext, useEffect, useMemo, useState } from "react";

const DBContext = createContext(null);

export function DBProvider({ children }) {
  const [dbPath, setDbPath] = useState("");

  // restore
  useEffect(() => {
    const saved = localStorage.getItem("dbPath");
    if (saved) setDbPath(saved);
  }, []);

  const setPath = (path) => {
    setDbPath(path || "");
    localStorage.setItem("dbPath", path || "");
  };

  const clearPath = () => {
    setDbPath("");
    localStorage.removeItem("dbPath");
  };

  const value = useMemo(() => ({ dbPath, setPath, clearPath }), [dbPath]);

  return <DBContext.Provider value={value}>{children}</DBContext.Provider>;
}

export const useDBCtx = () => {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error("useDBCtx must be used inside DBProvider");
  return ctx;
};
