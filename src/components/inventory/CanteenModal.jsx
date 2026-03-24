import React, { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from "@mui/material";
import { useSnackbar } from "notistack";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";

import { useCreateCanteenStockMutation, useTransferCanteenStockMutation } from "../../service/inventoryService";

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.data?.message ||
  err?.message ||
  "Something went wrong";

function CanteenModal({
  open,
  setOpen,
  selectedItem,
  setSelectedItem,
  setRefetch, // optional legacy
}) {
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = !!selectedItem;

  const defaultValues = useMemo(
    () => ({
      itemName: selectedItem?.itemName || "",
      price: selectedItem?.price || "",
      stockQuantity: selectedItem?.stockQuantity || "",
      category: selectedItem?.category || "",
      itemNo: selectedItem?.itemNo || "",
      status: selectedItem?.status || "Active",
    }),
    [selectedItem]
  );

  const schema = useMemo(
    () =>
      Yup.object({
        itemName: Yup.string().required("Item name is required"),
        price: Yup.number().typeError("MRP must be a number").required("MRP is required").positive(),
        stockQuantity: Yup.number()
          .typeError("Total stock must be a number")
          .required("Total stock is required")
          .min(0),
        category: Yup.string().required("Category is required"),
        itemNo: Yup.string().required("Item No is required"),
        status: Yup.string().oneOf(["Active", "Inactive"]).required("Status is required"),
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

  const createMutation = useCreateCanteenStockMutation();
  const transferMutation = useTransferCanteenStockMutation();

  // reset form when open/selected changes
  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  // cleanup on unmount
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
      // keep your exact backend payload logic
      const payload = isEdit
        ? { ...values, transferQty: values.stockQuantity }
        : { ...values, sellingPrice: values.price };

      const res = isEdit
        ? await transferMutation.mutateAsync(payload)
        : await createMutation.mutateAsync(payload);

      enqueueSnackbar(res?.message || (isEdit ? "Updated successfully" : "Created successfully"), {
        variant: "success",
      });

      // if you still use refetchKey pattern, keep it
      if (typeof setRefetch === "function") setRefetch((p) => p + 1);

      closeDialog();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: "error" });
    }
  };

  const saving = createMutation.isPending || transferMutation.isPending || isSubmitting;

  return (
    <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Edit Item" : "Add Item"}</DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers className="flex flex-col gap-4">
          <TextField
            label="Item Name"
            size="small"
            fullWidth
            {...register("itemName")}
            error={!!errors.itemName}
            helperText={errors.itemName?.message}
          />

          <TextField
            label="MRP"
            type="number"
            size="small"
            fullWidth
            {...register("price")}
            error={!!errors.price}
            helperText={errors.price?.message}
            onWheel={(e) => e.target.blur()}
          />

          <TextField
            label="Category"
            size="small"
            fullWidth
            {...register("category")}
            error={!!errors.category}
            helperText={errors.category?.message}
          />

          <TextField
            label="Item No"
            size="small"
            fullWidth
            {...register("itemNo")}
            error={!!errors.itemNo}
            helperText={errors.itemNo?.message}
          />

          <TextField
            label="Stock Quantity"
            type="number"
            size="small"
            fullWidth
            {...register("stockQuantity")}
            error={!!errors.stockQuantity}
            helperText={errors.stockQuantity?.message}
            onWheel={(e) => e.target.blur()}
          />

          <TextField
            select
            label="Status"
            size="small"
            fullWidth
            defaultValue="Active"
            {...register("status")}
            error={!!errors.status}
            helperText={errors.status?.message}
          >
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog} color="secondary" variant="outlined">
            Cancel
          </Button>

          <Button type="submit" variant="contained" color="primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default CanteenModal;
