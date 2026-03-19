import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";

import { useForm } from "react-hook-form";
import { useSnackbar } from "notistack";
import { useLocationMutation } from "../../hooks/useLocationMutation";
import { useEffect } from "react";

export default function LocationDialog({
  open,
  onClose,
  isEdit = false,
  selectedLocation = null,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const locationMutation = useLocationMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: "",
      locationName: "",
      baseUrl: "",
      custodyLimits: [
        { depositLimit: "", spendLimit: "", custodyType: "remand_prison" }, // Remand Prison
        { depositLimit: "", spendLimit: "", custodyType: "under_trail" }, // Under Trial
        { depositLimit: "", spendLimit: "", custodyType: "contempt_of_court" }, // Contempt of Court
      ],
    },
  });

  useEffect(() => {
    if (!open) return;

    if (isEdit && selectedLocation) {
      reset({
        name: selectedLocation.name || "",
        locationName: selectedLocation.locationName || "",
        baseUrl: selectedLocation.baseUrl || "",
        custodyLimits:
          selectedLocation.custodyLimits?.length === 3
            ? selectedLocation.custodyLimits
            : [
                { depositLimit: "", spendLimit: "", custodyType: "remand_prison" },
                { depositLimit: "", spendLimit: "", custodyType: "under_trail" },
                { depositLimit: "", spendLimit: "", custodyType: "contempt_of_court" },
              ],
      });
    } else {
      reset({
        name: "",
        locationName: "",
        baseUrl: "",
        custodyLimits: [
          { depositLimit: "", spendLimit: "", custodyType: "remand_prison" },
          { depositLimit: "", spendLimit: "", custodyType: "under_trail" },
          { depositLimit: "", spendLimit: "", custodyType: "contempt_of_court" },
        ],
      });
    }
  }, [open, isEdit, selectedLocation, reset]);

  const onSubmit = (values) => {
    locationMutation.mutate(
      { isEdit, selectedLocation, payload: values },
      {
        onSuccess: () => {
          enqueueSnackbar(isEdit ? "Location updated" : "Location created", {
            variant: "success",
          });
          onClose();
        },
        onError: (err) => {
          enqueueSnackbar(
            err?.response?.data?.message || "Something went wrong",
            { variant: "error" }
          );
        },
      }
    );
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const numberRules = {
    valueAsNumber: true,
    min: { value: 0, message: "Must be >= 0" },
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Update Location" : "Create Location"}</DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Name */}
          <TextField
            label="Name"
            fullWidth
            size="small"
            {...register("name", { required: "Name is required" })}
            error={!!errors.name}
            helperText={errors.name?.message}
          />

          {/* Location Name */}
          <TextField
            label="Location Name"
            fullWidth
            size="small"
            {...register("locationName", { required: "Location name is required" })}
            error={!!errors.locationName}
            helperText={errors.locationName?.message}
          />

          {/* Base URL */}
          <TextField
            label="Base URL"
            fullWidth
            size="small"
            placeholder="https://example.com"
            {...register("baseUrl", {
              required: "Base URL is required",
              pattern: {
                value: /^https?:\/\/.+/i,
                message: "Enter a valid URL starting with http/https",
              },
            })}
            error={!!errors.baseUrl}
            helperText={errors.baseUrl?.message}
          />

          {/* Custody limits blocks */}
          {[
            { title: "Remand Prison", idx: 0 },
            { title: "Under Trial", idx: 1 },
            { title: "Contempt of Court", idx: 2 },
          ].map(({ title, idx }) => (
            <div key={title}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Deposit Limit"
                    type="number"
                    fullWidth
                    size="small"
                    {...register(`custodyLimits.${idx}.depositLimit`, numberRules)}
                    error={!!errors?.custodyLimits?.[idx]?.depositLimit}
                    helperText={errors?.custodyLimits?.[idx]?.depositLimit?.message}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    label="Spend Limit"
                    type="number"
                    fullWidth
                    size="small"
                    {...register(`custodyLimits.${idx}.spendLimit`, numberRules)}
                    error={!!errors?.custodyLimits?.[idx]?.spendLimit}
                    helperText={errors?.custodyLimits?.[idx]?.spendLimit?.message}
                  />
                </Grid>
              </Grid>
            </div>
          ))}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={locationMutation.isPending}
          >
            {isEdit ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
