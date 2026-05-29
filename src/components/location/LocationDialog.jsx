import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { Eye, EyeOff } from "lucide-react";

import { useForm } from "react-hook-form";
import { useSnackbar } from "notistack";
import { useLocationMutation } from "../../hooks/useLocationMutation";
import { useEffect, useState } from "react";

export default function LocationDialog({
  open,
  onClose,
  isEdit = false,
  selectedLocation = null,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const locationMutation = useLocationMutation();
  const [showKeyId, setShowKeyId] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
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
      razorpay: {
        keyId: "",
        keySecret: "",
        webhookSecret: "",
        accountNumber: "",
        isActive: false,
      },
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
        razorpay: {
          keyId: selectedLocation.razorpay?.keyId || "",
          keySecret: "",
          webhookSecret: "",
          accountNumber: selectedLocation.razorpay?.accountNumber || "",
          isActive: Boolean(selectedLocation.razorpay?.isActive),
        },
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
        razorpay: {
          keyId: "",
          keySecret: "",
          webhookSecret: "",
          accountNumber: "",
          isActive: false,
        },
      });
    }
  }, [open, isEdit, selectedLocation, reset]);

  const onSubmit = (values) => {
    const payload = { ...values };
    const nextRazorpay = {
      keyId: values?.razorpay?.keyId?.trim() || "",
      accountNumber: values?.razorpay?.accountNumber?.trim() || "",
      isActive: Boolean(values?.razorpay?.isActive),
    };

    const keySecret = values?.razorpay?.keySecret?.trim();
    const webhookSecret = values?.razorpay?.webhookSecret?.trim();

    if (keySecret) {
      nextRazorpay.keySecret = keySecret;
    }

    if (webhookSecret) {
      nextRazorpay.webhookSecret = webhookSecret;
    }

    const prevRazorpay = selectedLocation?.razorpay || {};
    const hasRazorpayChanges =
      nextRazorpay.keyId !== (prevRazorpay.keyId || "") ||
      nextRazorpay.accountNumber !== (prevRazorpay.accountNumber || "") ||
      nextRazorpay.isActive !== Boolean(prevRazorpay.isActive) ||
      Boolean(keySecret) ||
      Boolean(webhookSecret);

    if (!isEdit || hasRazorpayChanges) {
      payload.razorpay = nextRazorpay;
    }

    locationMutation.mutate(
      { isEdit, selectedLocation, payload },
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

          {/* Razorpay */}
          <div style={{ fontWeight: 700, marginTop: 8 }}>Razorpay</div>
          <TextField
            label="Razorpay Key ID"
            fullWidth
            size="small"
            type={showKeyId ? "text" : "password"}
            {...register("razorpay.keyId", {
              validate: (value) => {
                const isActive = getValues("razorpay.isActive");
                if (!isActive) return true;
                return Boolean(value?.trim()) || "Key ID is required when Razorpay is active";
              },
            })}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setShowKeyId((prev) => !prev)}
                    aria-label={showKeyId ? "Hide key id" : "Show key id"}
                  >
                    {showKeyId ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            error={!!errors?.razorpay?.keyId}
            helperText={errors?.razorpay?.keyId?.message}
          />

          <TextField
            label={isEdit ? "Razorpay Key Secret (leave blank to keep existing)" : "Razorpay Key Secret"}
            fullWidth
            size="small"
            type={showKeySecret ? "text" : "password"}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setShowKeySecret((prev) => !prev)}
                    aria-label={showKeySecret ? "Hide key secret" : "Show key secret"}
                  >
                    {showKeySecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            {...register("razorpay.keySecret")}
          />

          <TextField
            label={isEdit ? "Webhook Secret (leave blank to keep existing)" : "Webhook Secret"}
            fullWidth
            size="small"
            type={showWebhookSecret ? "text" : "password"}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setShowWebhookSecret((prev) => !prev)}
                    aria-label={showWebhookSecret ? "Hide webhook secret" : "Show webhook secret"}
                  >
                    {showWebhookSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            {...register("razorpay.webhookSecret")}
          />

          <TextField
            label="Razorpay Account Number"
            fullWidth
            size="small"
            {...register("razorpay.accountNumber")}
          />

          <FormControlLabel
            control={<Checkbox {...register("razorpay.isActive")} />}
            label="Enable Razorpay for this location"
          />
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
