import React, { useEffect, useMemo } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    IconButton,
    Autocomplete,
    CircularProgress,
} from "@mui/material";
import { useSnackbar } from "notistack";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useCanteenItemOptionsQuery, useDeleteInventoryItemMutation, useUpsertInventoryMutation } from "../../hooks/useInventoryQuery";
import { Plus, Trash2 } from "lucide-react";

// ✅ TanStack hooks

function StoreInventoryDialog({
    open,
    setOpen,
    selectedData,
    setSelectedData,
    setRefetch, // optional legacy refetchKey
}) {
    const { enqueueSnackbar } = useSnackbar();

    // ✅ OPTIONS via TanStack (fetch only when open)
    const {
        data: optionsRes,
        isLoading: optionsLoading,
        error: optionsError,
    } = useCanteenItemOptionsQuery(open);

    const options = optionsRes?.data || optionsRes || [];

    const upsertMutation = useUpsertInventoryMutation();
    const deleteItemMutation = useDeleteInventoryItemMutation();

    const defaultValues = useMemo(() => {
        return {
            date: selectedData?.vendorPurchase?.date
                ? selectedData.vendorPurchase.date.split("T")[0]
                : "",
            invoiceNo: selectedData?.vendorPurchase?.invoiceNo || "",
            vendorName: selectedData?.vendorPurchase?.vendorName || "",
            vendorValue: selectedData?.vendorPurchase?.vendorValue || "",
            gatePassNumber: selectedData?.vendorPurchase?.gatePassNumber || "",
            status: selectedData?.vendorPurchase?.status || "Active",
            storeItems:
                selectedData?.items?.map((item) => ({
                    itemName: item.itemName || "",
                    itemNo: item.itemNo || "",
                    stock: item.stock || "",
                    sellingPrice: item.sellingPrice || "",
                    category: item.category || "",
                    status: item.status || "Active",
                    itemID: item._id || "",
                })) || [
                    {
                        itemName: "",
                        itemNo: "",
                        stock: "",
                        sellingPrice: "",
                        category: "",
                        status: "Active",
                        itemID: "",
                    },
                ],
        };
    }, [selectedData]);

    const schema = useMemo(() => {
        return Yup.object({
            date: Yup.string().required("Date is required"),
            invoiceNo: Yup.string().required("Invoice No is required"),
            vendorName: Yup.string().required("Vendor Name is required"),
            vendorValue: Yup.number().typeError("Vendor value must be a number").required("Vendor value is required").positive(),
            gatePassNumber: Yup.string().required("GP Number is required"),
            storeItems: Yup.array()
                .min(1, "At least 1 item is required")
                .of(
                    Yup.object().shape({
                        itemName: Yup.string().required("Item name is required"),
                        itemNo: Yup.string().when("itemName", {
                            is: (val) => options?.some((opt) => opt.itemName === val),
                            then: (s) => s.required("Item No is required"),
                            otherwise: (s) => s.optional(),
                        }),
                        category: Yup.string().when("itemName", {
                            is: (val) => options?.some((opt) => opt.itemName === val),
                            then: (s) => s.required("Category is required"),
                            otherwise: (s) => s.optional(),
                        }),
                        stock: Yup.number().typeError("Stock must be a number").required("Stock required").positive(),
                        sellingPrice: Yup.number()
                            .typeError("MRP must be a number")
                            .required("Selling Price required")
                            .positive(),
                    })
                ),
        });
    }, [options]);

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues,
        resolver: yupResolver(schema),
        mode: "onTouched",
    });

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "storeItems",
    });

    // ✅ when dialog opens / selectedData changes -> reset form values
    useEffect(() => {
        if (open) reset(defaultValues);
    }, [open, defaultValues, reset]);

    // cleanup
    useEffect(() => {
        return () => setSelectedData?.(null);
    }, [setSelectedData]);

    const closeDialog = () => {
        setOpen(false);
        if (typeof setSelectedData === "function") {
            setSelectedData(null);
        }
    };

    const getErrorMessage = (err) =>
        err?.response?.data?.message ||
        err?.response?.data?.data?.message ||
        err?.message ||
        "Something went wrong";

    const onSubmit = async (values) => {
        try {
            const isEdit = !!selectedData;
            const id = selectedData?.vendorPurchase?._id;

            const res = await upsertMutation.mutateAsync({ id, payload: values, isEdit });

            enqueueSnackbar(
                res?.data?.message || res?.message || (isEdit ? "Updated successfully" : "Created successfully"),
                { variant: "success" }
            );

            if (typeof setRefetch === "function") setRefetch((p) => p + 1);

            closeDialog();
        } catch (err) {
            console.log("UPSERT ERROR =>", err?.response?.data || err); // ✅ debug once
            enqueueSnackbar(getErrorMessage(err), { variant: "error" });
        }
    };


    const deleteServerItem = async (itemId) => {
        const res = await deleteItemMutation.mutateAsync(itemId);
        enqueueSnackbar(res?.data?.message || res?.message || "Item deleted", { variant: "success" });
        if (typeof setRefetch === "function") setRefetch((p) => p + 1);
    };

    const itemNameOptions = useMemo(
        () => (options || []).map((o) => o.itemName).filter(Boolean),
        [options]
    );

    return (
        <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
            <DialogTitle>{selectedData ? "Edit Store Inventory" : "Add Store Inventory"}</DialogTitle>

            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent dividers>
                    <div className="flex flex-col gap-4">
                        {/* Date */}
                        <TextField
                            type="date"
                            label="Date"
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            {...register("date")}
                            error={!!errors.date}
                            helperText={errors.date?.message}
                        />

                        <TextField
                            label="Invoice No"
                            fullWidth
                            {...register("invoiceNo")}
                            error={!!errors.invoiceNo}
                            helperText={errors.invoiceNo?.message}
                        />

                        <TextField
                            label="Vendor Name"
                            fullWidth
                            {...register("vendorName")}
                            error={!!errors.vendorName}
                            helperText={errors.vendorName?.message}
                        />

                        <TextField
                            label="Vendor Value"
                            fullWidth
                            {...register("vendorValue")}
                            error={!!errors.vendorValue}
                            helperText={errors.vendorValue?.message}
                        />

                        <TextField
                            label="GP Number"
                            fullWidth
                            {...register("gatePassNumber")}
                            error={!!errors.gatePassNumber}
                            helperText={errors.gatePassNumber?.message}
                        />

                        {/* Store Items */}
                        <div className="flex flex-col gap-4">
                            <h3 className="font-semibold">Store Items</h3>

                            {fields.map((field, index) => {
                                const itemErr = errors?.storeItems?.[index] || {};

                                return (
                                    <div key={field.id} className="flex flex-col gap-4 border p-4 rounded-lg">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Item Name (Autocomplete) */}
                                            <Controller
                                                control={control}
                                                name={`storeItems.${index}.itemName`}
                                                render={({ field: rhfField }) => (
                                                    <Autocomplete
                                                        freeSolo
                                                        options={itemNameOptions}
                                                        value={rhfField.value || ""}
                                                        loading={optionsLoading}
                                                        onChange={(e, newValue) => {
                                                            const selected = options?.find((opt) => opt.itemName === newValue);

                                                            if (selected) {
                                                                // set multiple fields at once
                                                                // easiest: replace current row keeping other properties
                                                                const current = {
                                                                    ...fields[index],
                                                                    itemName: selected.itemName || "",
                                                                    itemNo: selected.itemNo || "",
                                                                    sellingPrice: selected.price || 0,
                                                                    category: selected.category || "",
                                                                    status: selected.status || "Active",
                                                                    itemID: fields[index]?.itemID || "", // keep id if editing row
                                                                    stock: fields[index]?.stock || "", // keep stock typed by user
                                                                };

                                                                // update 1 row
                                                                const clone = [...fields];
                                                                clone[index] = { ...clone[index], ...current };
                                                                replace(clone);

                                                                rhfField.onChange(selected.itemName || "");
                                                            } else {
                                                                rhfField.onChange(newValue || "");
                                                            }
                                                        }}
                                                        onInputChange={(e, newInputValue) => {
                                                            rhfField.onChange(newInputValue || "");
                                                        }}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Pick or Type Item Name"
                                                                size="small"
                                                                error={!!itemErr?.itemName}
                                                                helperText={itemErr?.itemName?.message}
                                                                InputProps={{
                                                                    ...params.InputProps,
                                                                    endAdornment: (
                                                                        <>
                                                                            {optionsLoading ? <CircularProgress size={18} /> : null}
                                                                            {params.InputProps.endAdornment}
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                )}
                                            />

                                            <TextField
                                                label="Item No"
                                                size="small"
                                                {...register(`storeItems.${index}.itemNo`)}
                                                error={!!itemErr?.itemNo}
                                                helperText={itemErr?.itemNo?.message}
                                            />

                                            <TextField
                                                label="Stock"
                                                type="number"
                                                size="small"
                                                {...register(`storeItems.${index}.stock`)}
                                                error={!!itemErr?.stock}
                                                helperText={itemErr?.stock?.message}
                                                onWheel={(e) => e.target.blur()}
                                            />
                                        </div>

                                        <div className="grid grid-cols-[40%_40%_20%] gap-4 items-center">
                                            <TextField
                                                label="MRP"
                                                type="number"
                                                size="small"
                                                {...register(`storeItems.${index}.sellingPrice`)}
                                                error={!!itemErr?.sellingPrice}
                                                helperText={itemErr?.sellingPrice?.message}
                                                onWheel={(e) => e.target.blur()}
                                            />

                                            <TextField
                                                label="Category"
                                                size="small"
                                                {...register(`storeItems.${index}.category`)}
                                                error={!!itemErr?.category}
                                                helperText={itemErr?.category?.message}
                                            />

                                            <div className="flex justify-end pr-4">
                                                <IconButton
                                                    size="small"
                                                    sx={{ width: 50, height: 32 }}
                                                    disabled={fields.length === 1}
                                                    onClick={async () => {
                                                        const itemId = fields?.[index]?.itemID;

                                                        try {
                                                            // if editing & item exists on server -> delete server then remove from UI
                                                            if (selectedData?.items && itemId) {
                                                                await deleteServerItem(itemId);
                                                            }
                                                            remove(index);
                                                        } catch (err) {
                                                            enqueueSnackbar(
                                                                err?.response?.data?.message || "Delete failed",
                                                                { variant: "error" }
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <Trash2 fontSize="small" color="error" />
                                                </IconButton>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Plus fontSize="small" />}
                                onClick={() =>
                                    append({
                                        itemName: "",
                                        itemNo: "",
                                        stock: "",
                                        sellingPrice: "",
                                        category: "",
                                        status: "Active",
                                        itemID: "",
                                    })
                                }
                            >
                                Add Item
                            </Button>

                            {optionsError ? (
                                <p className="text-red-500 text-sm">
                                    {optionsError?.response?.data?.message ||
                                        optionsError?.message ||
                                        "Failed to load item options"}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>

                <DialogActions>
                    <Button onClick={closeDialog} color="secondary" variant="outlined">
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={isSubmitting || upsertMutation.isPending}
                    >
                        {upsertMutation.isPending ? "Saving..." : selectedData ? "Update" : "Create"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}

export default StoreInventoryDialog;
