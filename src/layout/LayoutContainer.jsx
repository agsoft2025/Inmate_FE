import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LocationDialog from "../components/location/LocationDialog";
import { useState } from "react";
import Button from "@mui/material/Button";
import { DatabaseZap, MapPin, User, Menu } from "lucide-react";
import { useLocationCtx } from "../context/LocationContext";
import DBLocationModal from "../components/location/DBLocationModal";
import { useDBCtx } from "../context/DBContext";
import Sidebar from "../components/Sidebar.jsx";

export default function LayoutContainer() {
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";
  const copyrightYear = new Date().getFullYear();
  const { user } = useAuth();
  const [locationModal, setLocationModal] = useState(false);
  const [dbModal, setDbModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { selectedLocation } = useLocationCtx();
  const { dbPath } = useDBCtx();
  const isAdminUser = user?.role === "ADMIN";
  const showLocationBadge = ["ADMIN", "POS"].includes(user?.role);

  return (
    <div className="min-h-dvh bg-slate-100 md:grid md:grid-cols-[240px_1fr]">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="h-16 min-h-16 bg-white border-b flex items-center justify-between px-2 md:px-5 min-w-0">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 flex-shrink-0"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="w-8 md:w-10 h-8 md:h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <User className="text-white w-4 h-4" />
            </div>

            <div className="min-w-0">
              <h1 className="text-md font-semibold truncate">{user?.fullName}</h1>
              <h3 className="text-green-500 text-sm md:text-md font-semibold truncate">
                {user?.role}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {showLocationBadge && (
              <div className="flex flex-col items-center">
                {isAdminUser ? (
                  <Button variant="text" onClick={() => setLocationModal(true)}>
                    <MapPin
                      className={`w-5 h-5 ${
                        selectedLocation?.locationName ? "text-green-500" : "text-red-500"
                      }`}
                    />
                  </Button>
                ) : (
                  <div className="p-1 rounded-full">
                    <MapPin
                      className={`w-5 h-5 ${
                        selectedLocation?.locationName ? "text-green-500" : "text-red-500"
                      }`}
                    />
                  </div>
                )}

                {selectedLocation?.locationName ? (
                  <span className="text-sm hidden lg:flex font-bold text-green-700 max-w-[120px] truncate">
                    {selectedLocation.locationName}
                  </span>
                ) : (
                  <span className="text-sm hidden lg:flex font-bold text-red-500">
                    No Location Selected
                  </span>
                )}
              </div>
            )}

            {user?.role === "ADMIN" && (
              <div className="flex flex-col items-center">
                <Button variant="text" onClick={() => setDbModal(true)}>
                  <DatabaseZap
                    className={`w-5 h-5 ${dbPath ? "text-green-500" : "text-red-500"}`}
                  />
                </Button>

                <span
                  className={`font-bold hidden lg:flex text-sm ${
                    dbPath ? "text-green-700" : "text-red-500"
                  }`}
                >
                  DB Location
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-0 md:px-4 md:pt-4">
          <Outlet />
        </main>

        <footer className="border-t bg-white px-6 py-3 text-xs text-slate-600">
          <div className="flex flex-col gap-1 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <span>{`Copyright (c) ${copyrightYear} Inmate Management Portal. All rights reserved.`}</span>
            <span className="font-medium text-slate-700">{`Version ${appVersion}`}</span>
          </div>
        </footer>
      </div>

      {isAdminUser && (
        <LocationDialog
          open={locationModal}
          onClose={() => setLocationModal(false)}
          isEdit={selectedLocation?._id}
          selectedLocation={selectedLocation}
        />
      )}

      <DBLocationModal open={dbModal} onClose={() => setDbModal(false)} />
    </div>
  );
}
