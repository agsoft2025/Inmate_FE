import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useTransactionsQuery } from "../hooks/useTransactionsQuery";
import { formatDate } from "../hooks/useFormatDate";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/").replace(/\/+$/, "");

const getAttachmentUrl = (fileUrl) => {
    if (!fileUrl) return "";
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

    const normalizedPath = String(fileUrl)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    return `${API_BASE_URL}/${normalizedPath}`;
};

export default function TransactionHistory() {
    const [range, setRange] = useState("daily");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [attachmentModal, setAttachmentModal] = useState({
        open: false,
        files: [],
        selectedIndex: 0,
    });

    const apiPage = page + 1;

    const { data, isLoading, isFetching } = useTransactionsQuery({
        range,
        page: apiPage,
        limit: pageSize,
    });

    const transactions = data?.transactions ?? [];
    const total = data?.totalRecords ?? 0;

    const openAttachmentModal = (files) => {
        const validFiles = Array.isArray(files) ? files.filter((file) => file?.fileUrl) : [];
        if (!validFiles.length) return;

        setAttachmentModal({
            open: true,
            files: validFiles,
            selectedIndex: 0,
        });
    };

    const closeAttachmentModal = () => {
        setAttachmentModal({
            open: false,
            files: [],
            selectedIndex: 0,
        });
    };

    const rows = useMemo(() => {
        return transactions.map((t) => {
            const studentName = t?.student_id?.student_name || "-";
            const regNo = t?.student_id?.registration_number || "-";

            const categories = t?.products?.length
                ? [...new Set(t.products.map((p) => p?.productId?.category).filter(Boolean))]
                : [];

            const totalItems = t?.products?.length
                ? t.products.reduce((sum, p) => sum + (p?.quantity || 0), 0)
                : 0;

            const amount = t.totalAmount || t.wageAmount || t.depositAmount || 0;

            return {
                id: t._id,
                inmateId: t.inmateId || "-",
                student: `${studentName} - ${regNo}`,
                products: t.products || [],
                totalItems,
                categories,
                amount,
                eventDate: t.eventDate,
                createdAt: t.createdAt,
                source: t.source || "-",
                status: t.isReversed || t.status === "reversed" ? "reversed" : t.status || "Completed",
                raw: t,
            };
        });
    }, [transactions]);

    const columns = useMemo(
        () => [
            {
                field: "inmateId",
                headerName: "Inmate ID",
                flex: 1,
                minWidth: 180,
                renderCell: (params) => {
                    const tx = params.row.raw;
                    return tx.custodyType ? `${tx.inmateId} - ${tx.custodyType}` : tx.inmateId;
                },
            },
            {
                field: "products",
                headerName: "Transaction",
                flex: 2,
                minWidth: 300,
                sortable: false,
                renderCell: (params) => {
                    const row = params.row;
                    const tx = row.raw;

                    if (tx.source === "FINANCIAL") {
                        if (tx.type === "deposit") {
                            return (
                                <div className="whitespace-normal break-words leading-5 py-2">
                                    <div>
                                        <b>Deposit Type:</b> <span className="text-gray-600">{tx.depositType || "-"}</span>
                                    </div>
                                    <div>
                                        <b>Relation:</b> <span className="text-gray-600">{tx.relationShipId || "-"}</span>
                                    </div>
                                </div>
                            );
                        }

                        if (tx.type === "withdrawal") {
                            return (
                                <div className="whitespace-normal break-words leading-5 py-2">
                                    <div>
                                        <b>Withdrawal Type:</b>{" "}
                                        <span className="text-gray-600">{tx.depositType || "-"}</span>
                                    </div>
                                    <div>
                                        <b>Relation:</b> <span className="text-gray-600">{tx.relationShipId || "-"}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div className="whitespace-normal break-words leading-5 py-2">
                                <div>
                                    <b>Work Assignment:</b>{" "}
                                    <span className="text-gray-600">{tx?.workAssignId?.name || "-"}</span>
                                </div>
                                <div>
                                    <b>Hours Worked:</b>{" "}
                                    <span className="text-gray-600">{tx.hoursWorked ?? "-"}</span>
                                </div>
                            </div>
                        );
                    }

                    const products = tx.products || [];
                    if (!products.length) return "-";

                    return (
                        <div className="whitespace-normal break-words leading-5 py-2">
                            {products.map((p) => (
                                <div key={p._id}>
                                    <b>{p?.productId?.itemName || "-"}</b>{" "}
                                    <span className="text-gray-500">x {p.quantity}</span>{" "}
                                    <span className="text-gray-400">(Rs {p?.productId?.price || 0} each)</span>
                                </div>
                            ))}
                            <div className="mt-1 text-xs text-gray-500">Total items: {row.totalItems}</div>
                        </div>
                    );
                },
            },
            {
                field: "categories",
                headerName: "Categories",
                flex: 1,
                minWidth: 200,
                sortable: false,
                renderCell: (params) => {
                    const tx = params.row.raw;

                    if (tx.source === "FINANCIAL") {
                        return <Chip size="small" label={tx.type || "-"} variant="outlined" />;
                    }

                    const categories = params.value || [];
                    if (!categories.length) return "-";

                    return (
                        <div className="flex flex-wrap gap-1 py-2">
                            {categories.map((c) => (
                                <Chip key={c} size="small" label={c} variant="outlined" />
                            ))}
                        </div>
                    );
                },
            },
            {
                field: "attachments",
                headerName: "Attachments",
                flex: 0.8,
                minWidth: 150,
                sortable: false,
                renderCell: (params) => {
                    const files = params.row.raw?.fileIds || [];
                    if (!files.length) return "-";

                    return (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openAttachmentModal(files)}
                        >
                            View
                        </Button>
                    );
                },
            },
            {
                field: "amount",
                headerName: "Transfer Amount",
                flex: 0.7,
                minWidth: 160,
                renderCell: (params) => {
                    const row = params.row;
                    const isReversed = row.status === "reversed" || row.raw?.isReversed;

                    return (
                        <span className={`font-semibold ${isReversed ? "text-red-600" : "text-green-600"}`}>
                            {params.value}
                        </span>
                    );
                },
            },
            {
                field: "createdAt",
                headerName: "Date",
                flex: 1,
                minWidth: 200,
                renderCell: (params) => {
                    const row = params.row;
                    const dateValue = row.eventDate || params.value;
                    return <span>{formatDate(dateValue)}</span>;
                },
            },
            {
                field: "source",
                headerName: "Source",
                flex: 0.8,
                minWidth: 140,
                renderCell: (params) => (
                    <Chip size="small" label={params.value || "-"} variant="outlined" />
                ),
            },
            {
                field: "status",
                headerName: "Status",
                flex: 0.9,
                minWidth: 180,
                sortable: false,
                renderCell: (params) => {
                    const status = params.value;
                    const isReversed = status === "reversed";

                    return (
                        <Chip
                            size="small"
                            label={isReversed ? "Transaction reversed" : status}
                            color={isReversed ? "error" : "default"}
                            variant={isReversed ? "filled" : "outlined"}
                        />
                    );
                },
            },
        ],
        []
    );

    const selectedFile = attachmentModal.files[attachmentModal.selectedIndex];

    return (
        <>
            <div className="w-full bg-gray-50 px-4 overflow-x-hidden">
                <div className="px-0 py-4 md:px-4 lg:px-8">
                    <div className="mx-auto max-w-8xl space-y-6">
                        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
                                <p className="text-sm text-gray-600 md:text-base">
                                    Monitor system statistics and recent activities
                                </p>
                                <p className="text-xs text-slate-500">
                                    {isFetching && !isLoading ? "Updating..." : ""}
                                </p>
                            </div>

                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel>Range</InputLabel>
                                <Select
                                    label="Range"
                                    value={range}
                                    onChange={(e) => {
                                        setRange(e.target.value);
                                        setPage(0);
                                    }}
                                >
                                    <MenuItem value="daily">Daily</MenuItem>
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                    <MenuItem value="yearly">Yearly</MenuItem>
                                </Select>
                            </FormControl>
                        </div>

                        <div className="rounded-xl bg-white p-3 shadow">
                            <Box sx={{ height: "calc(100vh - 260px)", width: "100%" }}>
                                <DataGrid
                                    rows={rows}
                                    columns={columns}
                                    loading={isLoading || isFetching}
                                    pagination
                                    paginationMode="server"
                                    rowCount={total}
                                    pageSizeOptions={[10, 20, 50]}
                                    paginationModel={{ page, pageSize }}
                                    onPaginationModelChange={(model) => {
                                        if (model.pageSize !== pageSize) {
                                            setPage(0);
                                            setPageSize(model.pageSize);
                                            return;
                                        }

                                        if (model.page !== page) setPage(model.page);
                                    }}
                                    disableRowSelectionOnClick
                                    getRowId={(row) => row.id}
                                    getRowHeight={() => "auto"}
                                    sx={{
                                        "& .MuiDataGrid-cell": {
                                            display: "flex",
                                            alignItems: "center",
                                            whiteSpace: "normal",
                                            lineHeight: 1.5,
                                            py: 1,
                                        },
                                        "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f8fafc" },
                                    }}
                                />
                            </Box>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={attachmentModal.open} onClose={closeAttachmentModal} fullWidth maxWidth="lg">
                <DialogTitle>Attachment Preview</DialogTitle>
                <DialogContent dividers>
                    {attachmentModal.files.length > 0 && (
                        <div className="flex flex-col gap-4 md:flex-row">
                            <div className="flex gap-3 overflow-x-auto md:w-56 md:flex-col md:overflow-y-auto">
                                {attachmentModal.files.map((file, index) => {
                                    const previewUrl = getAttachmentUrl(file.fileUrl);
                                    const isActive = attachmentModal.selectedIndex === index;

                                    return (
                                        <button
                                            key={file._id || `${file.fileUrl}-${index}`}
                                            type="button"
                                            onClick={() =>
                                                setAttachmentModal((prev) => ({
                                                    ...prev,
                                                    selectedIndex: index,
                                                }))
                                            }
                                            className={`shrink-0 overflow-hidden rounded-lg border bg-white p-1 transition ${
                                                isActive
                                                    ? "border-blue-500 ring-2 ring-blue-100"
                                                    : "border-slate-200"
                                            }`}
                                        >
                                            <img
                                                src={previewUrl}
                                                alt={`Attachment ${index + 1}`}
                                                className="h-20 w-20 rounded object-cover md:h-24 md:w-full"
                                            />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl bg-slate-100 p-4">
                                {selectedFile ? (
                                    <img
                                        src={getAttachmentUrl(selectedFile.fileUrl)}
                                        alt={`Attachment ${attachmentModal.selectedIndex + 1}`}
                                        className="max-h-[70vh] max-w-full rounded-lg object-contain shadow"
                                    />
                                ) : (
                                    <span className="text-sm text-slate-500">No attachment selected</span>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
