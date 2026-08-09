import { Button, Card, CardContent, Box, LinearProgress, Alert, Tooltip } from "@mui/material";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import { Upload, Check, Pencil, X, Download, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import { useBulkUploadStudentsMutation, useDownloadSampleCsvMutation } from "../hooks/useBulkUploadMutation";
import { useLocationCtx } from "../context/LocationContext";
import {
    parseCsv,
    serializeCsv,
    buildCorrectionRows,
    applyCorrectionsToRawRows,
} from "../utils/bulkImportCorrections";

/* =======================
   Display helpers for the results grid
======================= */

const FIELD_LABELS = {
    inmateId: "Inmate ID",
    firstName: "First Name",
    lastName: "Last Name",
    phonenumber: "Phone Number",
    status: "Status",
    balance: "Balance",
    cellNumber: "Cell Number",
    crimeType: "Crime Type",
    custodyType: "Custody Type",
    dateOfBirth: "Date of Birth",
    admissionDate: "Admission Date",
    location_id: "Location",
};
const humanizeField = (field) => FIELD_LABELS[field] || field;

const CONFIDENCE_META = {
    high: { label: "High", className: "bg-green-100 text-green-800" },
    medium: { label: "Medium", className: "bg-amber-100 text-amber-800" },
    low: { label: "Low", className: "bg-red-100 text-red-800" },
};

const STATUS_META = {
    pending: { label: "Pending", className: "bg-gray-100 text-gray-800" },
    accepted: { label: "Accepted", className: "bg-green-100 text-green-800" },
    edited: { label: "Edited", className: "bg-blue-100 text-blue-800" },
    skipped: { label: "Skipped", className: "bg-gray-200 text-gray-600" },
};

const Badge = ({ meta }) => (
    <span className={`px-2 py-1 rounded text-xs font-medium ${meta.className}`}>{meta.label}</span>
);

const BulkOperation = ({ location }) => {
    const { enqueueSnackbar } = useSnackbar();

    const inmateInputRef = useRef(null);
    const [selectedInmateFile, setSelectedInmateFile] = useState(null);

    const uploadMutation = useBulkUploadStudentsMutation();
    const downloadCsvMutation = useDownloadSampleCsvMutation();
    const { selectedLocation } = useLocationCtx();

    /* =======================
       Bulk-import error handling
       "AI Suggestion" is deterministic, rule-based (see
       ../utils/bulkImportCorrections.js) - this codebase has no AI/LLM API.
    ======================= */
    const [correctionRows, setCorrectionRows] = useState(null); // null = no results yet
    const [rawRowsByLine, setRawRowsByLine] = useState(null); // Map<row#, originalRow> or null (non-CSV source)
    const [csvHeaders, setCsvHeaders] = useState(null);
    const apiRef = useGridApiRef();

    const handleDownloadSampleCSV = async () => {
        if (!selectedLocation?._id) {
            enqueueSnackbar("Location not found", { variant: "error" });
            return;
        }

        try {
            const blob = await downloadCsvMutation.mutateAsync({
                type: "inmate",
                locationId: selectedLocation._id,
            });

            const fileName = "inmate_sample.csv";

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            enqueueSnackbar("Sample CSV downloaded", { variant: "success" });
        } catch (err) {
            enqueueSnackbar(
                err?.response?.data?.message || "Failed to download CSV file",
                { variant: "error" }
            );
        }
    };


    const handleInmateFileUpload = async (e) => {
        const file = e.target.files?.[0];
        setSelectedInmateFile(file);
        setCorrectionRows(null);
        setRawRowsByLine(null);
        setCsvHeaders(null);

        if (!file) {
            enqueueSnackbar("Please select a file.", { variant: "error" });
            return;
        }

        if (!selectedLocation?._id) {
            enqueueSnackbar("Location is missing.", { variant: "error" });
            return;
        }

        // Parse CSV client-side (best-effort, never blocks the upload) so we
        // can show real original values as "AI Suggestion" context and can
        // reconstruct a fully corrected file afterwards. xlsx/xls files are
        // binary and aren't parsed client-side - the results grid still
        // works for them, just without original-value-aware suggestions for
        // every field, and "Download corrected file" falls back to a
        // corrections-only export for that case.
        let localRawRowsByLine = null;
        let localHeaders = null;
        if (file.name?.toLowerCase().endsWith(".csv")) {
            try {
                const text = await file.text();
                const { headers, rows } = parseCsv(text);
                if (headers.length) {
                    localHeaders = headers;
                    localRawRowsByLine = new Map(rows.map((r) => [r.__row, r]));
                }
            } catch (parseErr) {
                console.warn("Could not parse CSV client-side for correction suggestions:", parseErr);
            }
        }
        setRawRowsByLine(localRawRowsByLine);
        setCsvHeaders(localHeaders);

        try {
            const payload = await uploadMutation.mutateAsync({
                locationId: selectedLocation._id,
                file,
            });

            if (!payload?.success) {
                enqueueSnackbar(payload?.message || "Upload failed.", { variant: "error" });
            } else {
                const rows = buildCorrectionRows(payload?.results, localRawRowsByLine, selectedLocation?._id || null);
                setCorrectionRows(rows);

                const created = payload?.results?.created?.length ?? 0;
                if (rows.length === 0) {
                    enqueueSnackbar(`Upload successful - all ${created} inmate(s) imported.`, { variant: "success" });
                } else {
                    enqueueSnackbar(
                        `Upload processed - ${created} imported, ${rows.length} row(s) need review below.`,
                        { variant: "info" }
                    );
                }
            }
        } catch (err) {
            enqueueSnackbar(
                err?.response?.data?.message || err?.message || "Upload failed. Check console for details.",
                {
                variant: "error",
                }
            );
        } finally {
            setSelectedInmateFile(null);
            if (inmateInputRef.current) inmateInputRef.current.value = null;
        }
    };

    /* =======================
       Results grid actions
    ======================= */

    const handleAccept = (id) => {
        setCorrectionRows((prev) =>
            prev.map((r) => (r.id === id && r.suggestion ? { ...r, status: "accepted" } : r))
        );
    };

    const handleSkip = (id) => {
        setCorrectionRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "skipped" } : r)));
    };

    const handleStartEdit = (id) => {
        apiRef.current?.startCellEditMode({ id, field: "suggestion" });
    };

    const processRowUpdate = (newRow, oldRow) => {
        const updated = {
            ...newRow,
            status: newRow.suggestion !== oldRow.suggestion ? "edited" : oldRow.status,
        };
        setCorrectionRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        return updated;
    };

    const highConfidencePendingCount = useMemo(
        () => (correctionRows || []).filter((r) => r.confidence === "high" && r.status === "pending" && r.suggestion).length,
        [correctionRows]
    );

    const handleAcceptAllHighConfidence = () => {
        setCorrectionRows((prev) =>
            prev.map((r) =>
                r.confidence === "high" && r.status === "pending" && r.suggestion ? { ...r, status: "accepted" } : r
            )
        );
    };

    const hasActionableCorrections = (correctionRows || []).some(
        (r) => r.status === "accepted" || r.status === "edited"
    );

    const handleDownloadCorrected = () => {
        const correctedRawRows = applyCorrectionsToRawRows(rawRowsByLine, correctionRows || []);

        let blob, fileName;
        if (correctedRawRows) {
            // Keep every original column, plus any field a correction targets
            // that wasn't already a column in the source file.
            const headerSet = new Set(csvHeaders || []);
            (correctionRows || []).forEach((r) => {
                if ((r.status === "accepted" || r.status === "edited") && !r.field.includes(" / ")) {
                    headerSet.add(r.field);
                }
            });
            const finalHeaders = Array.from(headerSet);
            const csv = serializeCsv(finalHeaders, correctedRawRows.map(({ __row, ...rest }) => rest));
            blob = new Blob([csv], { type: "text/csv" });
            fileName = "inmate_corrected.csv";
        } else {
            // Source file wasn't a CSV we could parse (e.g. xlsx) - export
            // just the corrections we know about instead of a full file.
            const headers = ["row", "inmateId", "field", "correctedValue", "status"];
            const rows = (correctionRows || []).map((r) => ({
                row: r.row ?? "",
                inmateId: r.inmateId,
                field: r.field,
                correctedValue: r.suggestion,
                status: r.status,
            }));
            const csv = serializeCsv(headers, rows);
            blob = new Blob([csv], { type: "text/csv" });
            fileName = "inmate_corrections.csv";
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        enqueueSnackbar("Corrected file downloaded", { variant: "success" });
    };

    const columns = useMemo(
        () => [
            {
                field: "row",
                headerName: "Row #",
                width: 90,
                renderCell: (params) => params.value ?? "—",
            },
            { field: "inmateId", headerName: "Inmate ID", width: 130 },
            {
                field: "field",
                headerName: "Field",
                width: 160,
                renderCell: (params) => humanizeField(params.value),
            },
            {
                field: "error",
                headerName: "Error",
                flex: 1,
                minWidth: 220,
                renderCell: (params) => (
                    <div className="py-1">
                        <div>{params.value}</div>
                        {params.row.note && <div className="text-xs text-gray-500">{params.row.note}</div>}
                    </div>
                ),
            },
            {
                field: "suggestion",
                headerName: "AI Suggestion",
                flex: 1,
                minWidth: 180,
                editable: true,
                renderCell: (params) =>
                    params.value ? (
                        <span>{params.value}</span>
                    ) : (
                        <span className="text-gray-400 italic">No suggestion</span>
                    ),
            },
            {
                field: "confidence",
                headerName: "Confidence",
                width: 130,
                renderCell: (params) => <Badge meta={CONFIDENCE_META[params.value] || CONFIDENCE_META.low} />,
            },
            {
                field: "status",
                headerName: "Status",
                width: 110,
                renderCell: (params) => <Badge meta={STATUS_META[params.value] || STATUS_META.pending} />,
            },
            {
                field: "actions",
                headerName: "Actions",
                width: 150,
                sortable: false,
                filterable: false,
                align: "center",
                renderCell: (params) => (
                    <div className="flex items-center justify-center h-full w-full gap-2">
                        <Tooltip title={params.row.suggestion ? "Accept suggestion" : "No suggestion to accept"}>
                            <span>
                                <button
                                    onClick={() => handleAccept(params.row.id)}
                                    disabled={!params.row.suggestion}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        cursor: params.row.suggestion ? "pointer" : "not-allowed",
                                        color: params.row.suggestion ? "#16a34a" : "#9ca3af",
                                    }}
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            </span>
                        </Tooltip>

                        <Tooltip title="Edit suggestion">
                            <button
                                onClick={() => handleStartEdit(params.row.id)}
                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#1976d2" }}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </Tooltip>

                        <Tooltip title="Skip row">
                            <button
                                onClick={() => handleSkip(params.row.id)}
                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                ),
            },
        ],
        []
    );

    return (
        <div className="mx-4">
            <div className="flex justify-between flex-col md:flex-row">
                <div>
                    <h1 className="text-2xl font-bold">Bulk Operations</h1>
                    <h3 className="text-md md:text-lg py-3 md:py-0">
                        Upload CSV files to add multiple inmates in bulk
                    </h3>
                </div>
                <Button
                    variant="outlined"
                    onClick={handleDownloadSampleCSV}
                    disabled={downloadCsvMutation.isPending}
                    sx={{height: "45px"}}
                    className="bg-primary! text-white!"
                >
                    {downloadCsvMutation.isPending ? "Downloading..." : "Download Sample CSV"}
                </Button>
            </div>


            <div className="my-4">
                <Card className="bg-blue-50! border-blue-200! rounded-2xl!">
                    <CardContent className="px-4">
                        <h3 className="font-semibold text-blue-900 mb-4">CSV Format Requirements:</h3>
                        <ul className="space-y-2 text-blue-800">
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>Headers: inmateId, firstName, lastName, phonenumber, status (balance optional)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>status should be either 'active' or 'inactive'</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>balance should be a number (can be 0)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 shrink-0"></span>
                                <span>All fields are required</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Upload CSV File</h3>

                <div className="flex items-center gap-4">
                    <input
                        ref={inmateInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleInmateFileUpload}
                        className="hidden"
                    />

                    <Button
                        variant="outlined"
                        onClick={() => inmateInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className="flex items-center gap-2 cursor-pointer border border-primary!"
                    >
                        <Upload className="w-4 h-4" />
                        Choose File
                    </Button>

                    {selectedInmateFile?.name && (
                        <p className="text-sm text-gray-600">{selectedInmateFile.name}</p>
                    )}
                </div>

                {uploadMutation.isPending && (
                    <Box sx={{ width: "100%", maxWidth: 480 }}>
                        <LinearProgress />
                        <p className="text-xs text-gray-500 mt-1">
                            Processing{selectedInmateFile?.name ? ` "${selectedInmateFile.name}"` : ""}...
                        </p>
                    </Box>
                )}
            </div>

            {/* =======================
                Bulk-import results
            ======================= */}
            {correctionRows !== null && (
                <div className="mt-6 space-y-3">
                    <div className="flex items-start justify-between flex-col md:flex-row gap-3">
                        <div>
                            <h3 className="font-semibold text-gray-900">Import Results</h3>
                            {correctionRows.length > 0 && (
                                <p className="text-sm text-gray-600">
                                    {correctionRows.length} row(s) need review. Accept, edit, or skip each suggestion,
                                    then download the corrected file to re-upload.
                                </p>
                            )}
                        </div>

                        {correctionRows.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<Sparkles className="w-4 h-4" />}
                                    onClick={handleAcceptAllHighConfidence}
                                    disabled={highConfidencePendingCount === 0}
                                >
                                    Accept all high-confidence suggestions ({highConfidencePendingCount})
                                </Button>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<Download className="w-4 h-4" />}
                                    onClick={handleDownloadCorrected}
                                    disabled={!hasActionableCorrections}
                                    className="bg-primary!"
                                >
                                    Download corrected file
                                </Button>
                            </div>
                        )}
                    </div>

                    {correctionRows.length === 0 ? (
                        <Alert severity="success">All rows imported successfully - no corrections needed.</Alert>
                    ) : (
                        <>
                            {!rawRowsByLine && (
                                <Alert severity="info">
                                    This file type doesn't support a fully reconstructed corrected file client-side -
                                    "Download corrected file" will export the corrections only. Upload a CSV for a
                                    complete corrected file.
                                </Alert>
                            )}

                            <div className="bg-white rounded-xl shadow p-3">
                                <Box sx={{ height: 480, width: "100%" }}>
                                    <DataGrid
                                        apiRef={apiRef}
                                        rows={correctionRows}
                                        columns={columns}
                                        processRowUpdate={processRowUpdate}
                                        onProcessRowUpdateError={(err) => console.error("Failed to update suggestion:", err)}
                                        disableRowSelectionOnClick
                                        pageSizeOptions={[10, 25, 50]}
                                        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                                        sx={{
                                            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f8fafc" },
                                        }}
                                    />
                                </Box>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default BulkOperation;
