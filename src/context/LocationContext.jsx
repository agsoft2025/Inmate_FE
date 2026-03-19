import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLocationsQuery } from "../hooks/useLocationMutation";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const { isAuth, booting } = useAuth();

  const [selectedLocation, setSelectedLocation] = useState(null);

  const locationsQuery = useLocationsQuery(isAuth && !booting);

  // restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedLocation");
    if (saved) {
      try {
        setSelectedLocation(JSON.parse(saved));
      } catch {
        localStorage.removeItem("selectedLocation");
      }
    }
  }, []);

  // set default from API
  useEffect(() => {
    const list = locationsQuery.data?.data;
    if (!Array.isArray(list) || list.length === 0) return;

    // 1) if there is a selected location, refresh it from list (updates localStorage too)
    if (selectedLocation?._id) {
      const latest = list.find((x) => x._id === selectedLocation._id);

      // if still exists, update state/localStorage with the latest object
      if (latest) {
        // avoid unnecessary re-renders
        const changed = JSON.stringify(latest) !== JSON.stringify(selectedLocation);
        if (changed) {
          setSelectedLocation(latest);
          localStorage.setItem("selectedLocation", JSON.stringify(latest));
        }
        return;
      }
    }

    // 2) if no selection or it was deleted, pick first as default
    const first = list[0];
    setSelectedLocation(first);
    localStorage.setItem("selectedLocation", JSON.stringify(first));
  }, [locationsQuery.data, selectedLocation?._id]);


  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    localStorage.setItem("selectedLocation", JSON.stringify(loc));
  };

  const value = useMemo(
    () => ({
      locations: locationsQuery.data?.data || [],
      selectedLocation,
      selectLocation,
      loading: locationsQuery.isLoading,
    }),
    [locationsQuery.data, selectedLocation]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocationCtx = () => useContext(LocationContext);
