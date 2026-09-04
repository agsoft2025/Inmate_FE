import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

import { useLocationCtx } from "../../context/LocationContext";

// Locations are created and assigned by the Super Admin on the Global panel.
// A Local Admin can only VIEW the location assigned to them — no create, edit,
// select or deactivate here.
export default function LocationDialog({ open, onClose }) {
  const { locations = [], selectedLocation, loading } = useLocationCtx();

  const assigned = selectedLocation || locations[0] || null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Assigned Location</DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <p className="text-sm text-gray-500">Loading location…</p>
        ) : assigned ? (
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Location Name</p>
            <p className="text-base font-semibold text-slate-900">
              {assigned.locationName || "—"}
            </p>
            {assigned.name ? (
              <>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Facility</p>
                <p className="text-sm text-slate-800">{assigned.name}</p>
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-red-500">
            No location has been assigned to your account yet. Please contact the Super Admin.
          </p>
        )}

        <p className="text-xs text-slate-500">
          Location details are managed by the Super Admin and are read-only here.
        </p>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
