import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLocationsQuery } from "../hooks/useLocationMutation";
import { getCookie, setCookie } from "../utils/cookieUtils";

const LocationContext = createContext(null);
const BASE_COOKIE_KEY = "selectedLocation";

export function LocationProvider({ children }) {
  const { isAuth, booting, user } = useAuth();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const locationsQuery = useLocationsQuery(isAuth && !booting, user?.id);
  const cookieKeySuffix = user?.id ? user.id : null;

  useEffect(() => {
    if (!cookieKeySuffix) {
      setSelectedLocation(null);
      return;
    }
    const saved = getCookie(BASE_COOKIE_KEY, cookieKeySuffix);
    if (saved) {
      try {
        setSelectedLocation(JSON.parse(saved));
        return;
      } catch (error) {
        console.error("Failed to parse stored location", error);
      }
    }
    setSelectedLocation(null);
  }, [cookieKeySuffix]);

  useEffect(() => {
    const list = locationsQuery.data?.data;
    if (!Array.isArray(list) || list.length === 0) {
      return;
    }

    if (selectedLocation?._id) {
      const latest = list.find((x) => x._id === selectedLocation._id);
      if (latest) {
        const changed = JSON.stringify(latest) !== JSON.stringify(selectedLocation);
        if (changed) {
          setSelectedLocation(latest);
          setCookie(BASE_COOKIE_KEY, JSON.stringify(latest), {}, cookieKeySuffix);
        }
        return;
      }
    }

    const first = list[0];
    setSelectedLocation(first);
    setCookie(BASE_COOKIE_KEY, JSON.stringify(first), {}, cookieKeySuffix);
  }, [locationsQuery.data, selectedLocation?._id]);

  const selectLocation = (loc) => {
    setSelectedLocation(loc);
    setCookie(BASE_COOKIE_KEY, JSON.stringify(loc), {}, cookieKeySuffix);
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
