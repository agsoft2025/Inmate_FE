import React, { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  MenuItem,
} from "@mui/material";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useSnackbar } from "notistack";
import { useSaveBackupMutation } from "../../hooks/useLocationMutation";
import { useDBCtx } from "../../context/DBContext";

// ✅ Validation schema
const schema = yup.object({
  path: yup.string().required("Path is required"),
  cronTime: yup.string().required("Cron time is required"),
  time: yup.date().nullable().required("Time is required"),
  enabled: yup.boolean(),
});

export default function DBLocationModal({ open, onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const backupMutation = useSaveBackupMutation();
  const { dbPath, setPath } = useDBCtx();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      path: "",
      cronTime: "1 hour",
      time: new Date(),
      enabled: true,
    },
  });

  // ✅ Pre-fill when modal opens / dbPath changes
  useEffect(() => {
    if (!open) return;

    reset({
      path: dbPath || "",
      cronTime: "1 hour",
      time: new Date(),
      enabled: true,
    });
  }, [open, dbPath, reset]);

  const submit = (values) => {
    const payload = {
      path: values.path.replace(/\\/g, "\\\\"),
      cronTime: values.cronTime,
      time: values.time
        ? values.time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      enabled: values.enabled,
    };

    backupMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data?.success) {
          setPath(values.path); // ✅ store for icon + label
          enqueueSnackbar("Backup saved successfully", { variant: "success" });
          onClose();
          reset(); // clear
        } else {
          enqueueSnackbar(data?.message || "Failed to save backup", {
            variant: "error",
          });
        }
      },
      onError: (err) => {
        enqueueSnackbar(
          err?.response?.data?.message || "Failed to save backup",
          { variant: "error" }
        );
      },
    });
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(submit)}>
        <DialogTitle>Configure DB Location</DialogTitle>

        <DialogContent className="flex flex-col gap-4">
          <TextField
            label="Backup Path"
            fullWidth
            sx={{ marginTop: "1rem" }}
            placeholder="C:\\Users\\nishanth\\backup"
            {...register("path")}
            error={!!errors.path}
            helperText={errors.path?.message}
          />

          <TextField
            select
            label="Cron Time"
            fullWidth
            defaultValue="1 hour"
            {...register("cronTime")}
            error={!!errors.cronTime}
            helperText={errors.cronTime?.message}
          >
            <MenuItem value="1 hour">1 Hour</MenuItem>
            <MenuItem value="2 hours">2 Hours</MenuItem>
            <MenuItem value="6 hours">6 Hours</MenuItem>
            <MenuItem value="12 hours">12 Hours</MenuItem>
            <MenuItem value="24 hours">24 Hours</MenuItem>
          </TextField>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Controller
              name="time"
              control={control}
              render={({ field }) => (
                <TimePicker
                  label="Select Time"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.time,
                      helperText: errors.time?.message,
                    },
                  }}
                />
              )}
            />
          </LocalizationProvider>

          <FormControlLabel
            control={
              <Controller
                name="enabled"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={!!field.value} onChange={field.onChange} />
                )}
              />
            }
            label="Enabled"
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} variant="outlined" color="secondary">
            Cancel
          </Button>

          <Button type="submit" variant="contained" disabled={backupMutation.isPending}>
            {backupMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
