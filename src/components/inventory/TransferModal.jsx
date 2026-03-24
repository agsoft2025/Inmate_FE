import React, { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import { useSnackbar } from "notistack";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useTransferInventoryMutation } from "../../hooks/useInventoryQuery";

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.data?.message ||
  err?.message ||
  "Something went wrong";

function TransferModal({
  open,
  setOpen,
  selectedItem,
  setSelectedItem,
  setRefetch, // optional legacy refetchKey
}) {
  const { enqueueSnackbar } = useSnackbar();

  const defaultValues = useMemo(
    () => ({
      itemNo: selectedItem?.itemNo || "",
      transferQty: "",
    }),
    [selectedItem]
  );

  const schema = useMemo(
    () =>
      Yup.object({
        itemNo: Yup.string().required("Item No is required"),
        transferQty: Yup.number()
          .typeError("Transfer quantity must be a number")
          .required("Transfer quantity is required")
          .positive("Must be greater than 0"),
      }),
    []
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues,
    resolver: yupResolver(schema),
    mode: "onTouched",
  });

  const transferMutation = useTransferInventoryMutation();

  // reset form when modal opens / selectedItem changes
  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  // cleanup
  useEffect(() => {
    return () => {
      if (typeof setSelectedItem === "function") setSelectedItem(null);
    };
  }, [setSelectedItem]);

  const closeDialog = () => {
    if (typeof setOpen === "function") setOpen(false);
    if (typeof setSelectedItem === "function") setSelectedItem(null);
  };

  const onSubmit = async (values) => {
    try {
      const res = await transferMutation.mutateAsync(values);

      enqueueSnackbar(res?.message || "Transferred successfully", {
        variant: "success",
      });

      if (typeof setRefetch === "function") setRefetch((p) => p + 1);

      closeDialog();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: "error" });
    }
  };

  const saving = transferMutation.isPending || isSubmitting;

  return (
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
      <DialogTitle>Transfer Item</DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers className="flex flex-col gap-4">
          <TextField
            label="Item No"
            size="small"
            fullWidth
            InputProps={{ readOnly: true }}
            {...register("itemNo")}
            error={!!errors.itemNo}
            helperText={errors.itemNo?.message}
          />

          <TextField
            label="Transfer Quantity"
            type="number"
            size="small"
            fullWidth
            {...register("transferQty")}
            error={!!errors.transferQty}
            helperText={errors.transferQty?.message}
            onWheel={(e) => e.target.blur()}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} color="secondary" variant="outlined">
            Cancel
          </Button>

          <Button type="submit" variant="contained" color="primary" disabled={saving}>
            {saving ? "Transferring..." : "Transfer"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default TransferModal;
