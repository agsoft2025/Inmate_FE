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
  const { user } = useAuth();
  const [locationModal, setLocationModal] = useState(false);
  const [dbModal, setDbModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { selectedLocation } = useLocationCtx();
  const { dbPath } = useDBCtx();

  return (
    <div className="min-h-screen bg-slate-100 md:grid md:grid-cols-[240px_1fr]">
      {/* Sidebar (desktop + mobile drawer) */}
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Main */}
      <div className="flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-2 md:px-5 min-w-0">
          {/* Left side */}
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            {/* Hamburger (mobile only) */}
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

            {/* Name + role (shrink-safe) */}
            <div className="min-w-0">
              <h1 className="text-md font-semibold truncate">
                {user?.fullName}
              </h1>
              <h3 className="text-green-500 text-sm md:text-md font-semibold truncate">
                {user?.role}
              </h3>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {/* Location */}
            {user?.role === "ADMIN" && (
              <div className="flex flex-col items-center">
                <Button variant="text" onClick={() => setLocationModal(true)}>
                  <MapPin
                    className={`w-5 h-5 ${
                      selectedLocation?.locationName
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  />
                </Button>

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

            {/* DB Location */}
            {user?.role === "ADMIN" && (
              <div className="flex flex-col items-center">
                <Button variant="text" onClick={() => setDbModal(true)}>
                  <DatabaseZap
                    className={`w-5 h-5 ${
                      dbPath ? "text-green-500" : "text-red-500"
                    }`}
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

        <main className="flex-1 m-0 md:m-4 min-w-0">
          <Outlet />
        </main>
      </div>

      <LocationDialog
        open={locationModal}
        onClose={() => setLocationModal(false)}
        isEdit={selectedLocation?._id}
        selectedLocation={selectedLocation}
      />

      <DBLocationModal open={dbModal} onClose={() => setDbModal(false)} />
    </div>
  );
}
