import React, { useEffect, useMemo, useRef, useState } from "react";
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
    Chip,
} from "@mui/material";
import { useSnackbar } from "notistack";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useCanteenItemOptionsQuery, useDeleteInventoryItemMutation, useUpsertInventoryMutation } from "../../hooks/useInventoryQuery";
import { Plus, Trash2, ScanLine } from "lucide-react";
import { runOcr, parseInvoiceFields, getConfidenceTier } from "../../utils/documentScanUtils";

// Fields that highlight red in the LOW_CONFIDENCE_SX style below (border +
// tinted background) when their scanned confidence is under the "low" tier
// and the user hasn't edited the value since the scan.
const LOW_CONFIDENCE_SX = {
    "& .MuiOutlinedInput-root": {
        backgroundColor: "#fef2f2",
        "& fieldset": { borderColor: "#ef4444" },
    },
};

// Labels shown in the "filled N fields from the invoice" confirmation -
// keys match parseInvoiceFields()'s return shape.
const INVOICE_FIELD_LABELS = {
    date: "Date",
    invoiceNo: "Invoice No",
    vendorName: "Vendor Name",
    vendorValue: "Vendor Value",
    gatePassNumber: "GP Number",
};

// ✅ TanStack hooks

function StoreInventoryDialog({
    open,
    setOpen,
    selectedData,
    setSelectedData,
    setRefetch, // optional legacy refetchKey
    initialItems, // optional: pre-fill storeItems for a fresh "create" (e.g. reorder suggestion)
}) {
    const { enqueueSnackbar } = useSnackbar();

    // Scan Invoice: OCR + field extraction. Never touches storeItems, only
    // the invoice-level fields above them - line items still have to be
    // added/reviewed by hand.
    const [isExtracting, setIsExtracting] = useState(false);
    const invoiceFileInputRef = useRef(null);
    const [scannedFileName, setScannedFileName] = useState(null);
    // Per-field OCR confidence + the value that was in the field right after
    // the scan, keyed by form field name - e.g.
    // { invoiceNo: { confidence: 42, scannedValue: "INV-2026-0456" } }.
    // Kept separate per field (merged across scans) so a badge only ever
    // describes the field it's attached to, and clears itself once the user
    // edits that field's value away from what the scan produced.
    const [fieldConfidence, setFieldConfidence] = useState({});

    // ✅ OPTIONS via TanStack (fetch only when open)
    const {
        data: optionsRes,
        isLoading: optionsLoading,
        error: optionsError,
    } = useCanteenItemOptionsQuery(open);

    const options = optionsRes?.data || optionsRes || [];

    const upsertMutation = useUpsertInventoryMutation();
    const deleteItemMutation = useDeleteInventoryItemMutation();

    // A "reorder suggestion" (or any other caller) can seed a fresh Create
    // form with one or more line items without turning this into an edit -
    // it only applies when there's no selectedData (i.e. still create mode).
    const prefillStoreItems = useMemo(() => {
        if (selectedData || !Array.isArray(initialItems) || initialItems.length === 0) {
            return null;
        }
        return initialItems.map((item) => ({
            itemName: item.itemName || "",
            itemNo: item.itemNo || "",
            stock: item.stock ?? "",
            sellingPrice: item.sellingPrice ?? "",
            category: item.category || "",
            status: item.status || "Active",
            itemID: item.itemID || "",
        }));
    }, [selectedData, initialItems]);

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
                })) ||
                prefillStoreItems || [
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
    }, [selectedData, prefillStoreItems]);

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
        setValue,
        watch,
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

    // Runs OCR on the selected photo/scan and pre-fills whatever invoice
    // fields it can confidently read, along with a per-field confidence
    // score (from Tesseract.js's own word-level confidence where available).
    // Only ever calls setValue() - never submits the form. The user
    // reviews/edits everything and clicks the existing Create/Update button
    // themselves.
    const handleInvoiceFileSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file again later
        if (!file) return;

        setScannedFileName(file.name);
        setIsExtracting(true);
        try {
            const { text, confidence: pageConfidence, words } = await runOcr(file);
            const extracted = parseInvoiceFields(text, words, pageConfidence);
            const foundFields = Object.keys(extracted);

            foundFields.forEach((key) => {
                setValue(key, extracted[key].value, { shouldValidate: true, shouldDirty: true });
            });

            setFieldConfidence((prev) => {
                const next = { ...prev };
                foundFields.forEach((key) => {
                    next[key] = { confidence: extracted[key].confidence, scannedValue: extracted[key].value };
                });
                return next;
            });

            if (foundFields.length > 0) {
                enqueueSnackbar(
                    `Filled ${foundFields.length} field${foundFields.length === 1 ? "" : "s"} from the invoice (${foundFields
                        .map((key) => INVOICE_FIELD_LABELS[key])
                        .join(", ")}). Please review before submitting - low-confidence fields are highlighted.`,
                    { variant: "info" }
                );
            } else {
                enqueueSnackbar(
                    "Couldn't confidently read any fields from that image - please fill them in manually.",
                    { variant: "warning" }
                );
            }
        } catch (err) {
            enqueueSnackbar(
                "Couldn't scan that image. Please try again or fill in the fields manually.",
                { variant: "error" }
            );
        } finally {
            setIsExtracting(false);
        }
    };

    // Reads back the confidence for a field, but only while the current
    // form value still matches what the scan produced - returns undefined
    // (meaning: show no badge at all) once the user edits the field away
    // from what OCR read, since the confidence no longer describes what's
    // on screen. A defined-but-null return means "show a badge, confidence
    // just wasn't available" (handled by getConfidenceTier's "unknown" tier).
    const getActiveFieldConfidence = (fieldKey) => {
        const info = fieldConfidence[fieldKey];
        if (!info) return undefined;
        const liveValue = watch(fieldKey);
        if (String(liveValue ?? "") !== String(info.scannedValue ?? "")) return undefined;
        return info.confidence;
    };

    const isLowConfidenceField = (fieldKey) => {
        const confidence = getActiveFieldConfidence(fieldKey);
        if (confidence === undefined) return false;
        return getConfidenceTier(confidence).level === "low";
    };

    const renderConfidenceBadge = (fieldKey) => {
        const confidence = getActiveFieldConfidence(fieldKey);
        if (confidence === undefined) return null;

        const tier = getConfidenceTier(confidence);
        return (
            <div className="flex items-center gap-2 -mt-2 mb-1">
                <Chip
                    size="small"
                    label={`OCR: ${tier.label}`}
                    color={tier.color}
                    variant={tier.level === "high" ? "outlined" : "filled"}
                />
                {tier.level === "low" && (
                    <span className="text-xs text-red-600">Please verify this field</span>
                )}
            </div>
        );
    };

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
                        {/* Scan Invoice - OCR pre-fill, review before submit */}
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700">Scan Invoice</p>
                                <p className="text-xs text-slate-500">
                                    Photograph or upload the vendor invoice to pre-fill the fields below. Everything stays editable - nothing is submitted automatically.
                                </p>
                            </div>

                            <Button
                                variant="outlined"
                                size="small"
                                disabled={isExtracting}
                                startIcon={isExtracting ? <CircularProgress size={16} /> : <ScanLine size={16} />}
                                onClick={() => invoiceFileInputRef.current?.click()}
                                sx={{ whiteSpace: "nowrap" }}
                            >
                                {isExtracting ? "Extracting..." : "Scan Invoice"}
                            </Button>

                            <input
                                ref={invoiceFileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                hidden
                                onChange={handleInvoiceFileSelected}
                            />
                        </div>

                        {scannedFileName && (
                            <p className="-mt-2 text-xs text-slate-500">
                                Scanned document: <span className="font-medium text-slate-700">{scannedFileName}</span>
                            </p>
                        )}

                        {/* Date */}
                        <div>
                            <TextField
                                type="date"
                                label="Date"
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                {...register("date")}
                                error={!!errors.date}
                                helperText={errors.date?.message}
                                sx={isLowConfidenceField("date") ? LOW_CONFIDENCE_SX : undefined}
                            />
                            {renderConfidenceBadge("date")}
                        </div>

                        <div>
                            <TextField
                                label="Invoice No"
                                fullWidth
                                {...register("invoiceNo")}
                                error={!!errors.invoiceNo}
                                helperText={errors.invoiceNo?.message}
                                sx={isLowConfidenceField("invoiceNo") ? LOW_CONFIDENCE_SX : undefined}
                            />
                            {renderConfidenceBadge("invoiceNo")}
                        </div>

                        <div>
                            <TextField
                                label="Vendor Name"
                                fullWidth
                                {...register("vendorName")}
                                error={!!errors.vendorName}
                                helperText={errors.vendorName?.message}
                                sx={isLowConfidenceField("vendorName") ? LOW_CONFIDENCE_SX : undefined}
                            />
                            {renderConfidenceBadge("vendorName")}
                        </div>

                        <div>
                            <TextField
                                label="Vendor Value"
                                fullWidth
                                {...register("vendorValue")}
                                error={!!errors.vendorValue}
                                helperText={errors.vendorValue?.message}
                                sx={isLowConfidenceField("vendorValue") ? LOW_CONFIDENCE_SX : undefined}
                            />
                            {renderConfidenceBadge("vendorValue")}
                        </div>

                        <div>
                            <TextField
                                label="GP Number"
                                fullWidth
                                {...register("gatePassNumber")}
                                error={!!errors.gatePassNumber}
                                helperText={errors.gatePassNumber?.message}
                                sx={isLowConfidenceField("gatePassNumber") ? LOW_CONFIDENCE_SX : undefined}
                            />
                            {renderConfidenceBadge("gatePassNumber")}
                        </div>

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
