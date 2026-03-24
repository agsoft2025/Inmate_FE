import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
} from "@mui/material";
import { Trash2 } from "lucide-react";

const ConfirmDeleteDialog = ({
  open,
  title = "Delete",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,              // optional (ex: user fullname)
  subText,               // optional (ex: username / id)
  onClose,
  onConfirm,
  loading = false,
  confirmText = "Delete",
  cancelText = "Cancel",
}) => {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        <span className="text-red-600">
          <Trash2 size={18} />
        </span>
        <span className="font-bold">{title}</span>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Typography className="text-gray-700">{description}</Typography>

        {(itemName || subText) && (
          <div className="mt-4 bg-gray-50 border rounded-xl p-3">
            {itemName && (
              <p className="text-sm text-gray-800">
                <span className="font-semibold">Name:</span> {itemName}
              </p>
            )}
            {subText && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-semibold">Info:</span> {subText}
              </p>
            )}
          </div>
        )}
      </DialogContent>

      <DialogActions className="px-6 pb-5">
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={loading}
          className="rounded-xl"
        >
          {cancelText}
        </Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          className="rounded-xl bg-red-600 hover:bg-red-700"
          sx={{
            backgroundColor: "#dc2626",
            "&:hover": { backgroundColor: "#b91c1c" },
          }}
        >
          {loading ? "Deleting..." : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;
