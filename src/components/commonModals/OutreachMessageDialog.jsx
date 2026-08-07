import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Divider,
} from "@mui/material";
import { MessageCircle } from "lucide-react";

const MAX_OUTREACH_MESSAGE_LENGTH = 500;

// Review-and-edit modal for the Predictive Low-Balance Outreach feature.
// The message is always pre-filled from a draft but never sent on its own -
// sending only happens when staff explicitly click "Send" below.
const OutreachMessageDialog = ({
  open,
  inmate,
  defaultMessage = "",
  onClose,
  onSend,
  sending = false,
}) => {
  const [message, setMessage] = useState(defaultMessage);

  // Re-seed the editable draft whenever a new inmate's message is opened
  useEffect(() => {
    if (open) {
      setMessage(defaultMessage);
    }
  }, [open, defaultMessage]);

  const trimmedMessage = message.trim();
  const isOverLimit = message.length > MAX_OUTREACH_MESSAGE_LENGTH;
  const canSend = Boolean(trimmedMessage) && !isOverLimit && !sending;

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        <span className="text-blue-600">
          <MessageCircle size={18} />
        </span>
        <span className="font-bold">Draft Outreach Message</span>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {inmate && (
          <div className="mt-2 mb-4 bg-gray-50 border rounded-xl p-3">
            <p className="text-sm text-gray-800">
              <span className="font-semibold">Inmate:</span>{" "}
              {inmate.firstName} {inmate.lastName} ({inmate.inmateId})
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-semibold">Current Balance:</span> ₹ {inmate.balance ?? 0}
            </p>
          </div>
        )}

        <Typography className="text-gray-600 text-sm mb-2">
          Review and edit the message below. Nothing is sent until you click Send.
        </Typography>

        <TextField
          multiline
          minRows={5}
          maxRows={10}
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
          error={isOverLimit}
          helperText={
            isOverLimit
              ? `Message is too long (${message.length}/${MAX_OUTREACH_MESSAGE_LENGTH})`
              : `${message.length}/${MAX_OUTREACH_MESSAGE_LENGTH} characters`
          }
        />
      </DialogContent>

      <DialogActions className="px-6 pb-5">
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={sending}
          className="rounded-xl"
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={() => onSend(trimmedMessage)}
          disabled={!canSend}
          className="rounded-xl"
          sx={{
            backgroundColor: "#2563eb",
            "&:hover": { backgroundColor: "#1d4ed8" },
          }}
        >
          {sending ? "Sending..." : "Send"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OutreachMessageDialog;
