import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import { DataGrid } from "@mui/x-data-grid";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useAuditLogsQuery } from "../hooks/useAuditLogsQuery";

const ACTION_META = {
    CREATE: { label: "Created", color: "success" },
    READ: { label: "Viewed", color: "info" },
    UPDATE: { label: "Updated", color: "warning" },
    DELETE: { label: "Deleted", color: "error" },
    LOGIN: { label: "Logged in", color: "primary" },
    LOGOUT: { label: "Logged out", color: "default" },
    GENERATE: { label: "Generated", color: "secondary" },
    BULK_UPSERT: { label: "Bulk updated", color: "warning" },
    UPDATE_STOCK: { label: "Updated stock", color: "warning" },
    CREATE_AND_PAY: { label: "Created and paid", color: "success" },
};

const ENTITY_LABELS = {
    Intimate_Balance_Report: "Inmate Balance Report",
    TuckShop_Transaction_Report: "Tuckshop Transaction Report",
    POSShoppingCart: "POS Shopping Cart",
    Financial: "Financial Transaction",
    User: "User",
    Inmate: "Inmate",
    Department: "Department",
    TuckShop: "Tuckshop Item",
    AuditLog: "Audit Log",
};

const humanize = (value = "") =>
    String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase());

const humanizeEntity = (value = "") => ENTITY_LABELS[value] || humanize(value);

const formatValue = (value) => {
    if (value == null || value === "") return "-";
    if (Array.isArray(value)) return value.map(formatValue).join(", ");
    if (typeof value === "object") {
        const parts = Object.entries(value)
            .filter(([, v]) => v != null && v !== "")
            .slice(0, 3)
            .map(([key, v]) => `${humanize(key)}: ${formatValue(v)}`);
        return parts.length ? parts.join(" | ") : "-";
    }
    return humanize(value);
};

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};

const getActorName = (item) =>
    item?.userId?.fullName ||
    item?.userId?.username ||
    item?.username ||
    "-";

const getActionMeta = (action) => ACTION_META[action] || { label: humanize(action), color: "default" };

const getReference = (item) => {
    const inmateId = item?.changes?.inmateId;
    if (inmateId) return inmateId;
    if (item?.targetId) return String(item.targetId);
    return "-";
};

const getChangeSummary = (changes) => {
    if (!changes || typeof changes !== "object") return "-";

    const entries = Object.entries(changes)
        .filter(([key, value]) => !["_id", "__v"].includes(key) && value != null && value !== "")
        .slice(0, 4);

    if (!entries.length) return "-";

    return entries.map(([key, value]) => `${humanize(key)}: ${formatValue(value)}`).join(" | ");
};

export default function AuditTrails() {
    const { enqueueSnackbar } = useSnackbar();

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const apiPage = page + 1;

    const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery({
        page: apiPage,
        limit: pageSize,
    });

    const rows = useMemo(() => {
        const list = data?.data ?? [];
        return list.map((item, idx) => {
            const actionMeta = getActionMeta(item?.action);

            return {
                id: item._id ?? `${apiPage}-${idx}`,
                actor: getActorName(item),
                action: item?.action || "-",
                actionLabel: actionMeta.label,
                actionColor: actionMeta.color,
                targetModel: humanizeEntity(item?.targetModel || "-"),
                description: humanize(item?.description || "-"),
                details: getChangeSummary(item?.changes),
                reference: getReference(item),
                when: formatDateTime(item?.createdAt),
            };
        });
    }, [data, apiPage]);

    const columns = useMemo(
        () => [
            {
                field: "when",
                headerName: "When",
                flex: 1,
                minWidth: 160,
            },
            {
                field: "actor",
                headerName: "User",
                flex: 1,
                minWidth: 150,
            },
            {
                field: "action",
                headerName: "Action",
                flex: 1,
                minWidth: 150,
                renderCell: (params) => {
                    const { actionLabel, actionColor } = params.row;
                    return <Chip size="small" label={actionLabel} color={actionColor} variant="outlined" />;
                },
                sortable: false,
            },
            {
                field: "targetModel",
                headerName: "Module",
                flex: 1.2,
                minWidth: 180,
            },
            {
                field: "description",
                headerName: "What happened",
                flex: 2,
                minWidth: 260,
                renderCell: (params) => (
                    <Tooltip title={params.value || "-"} arrow>
                        <Typography variant="body2" noWrap>
                            {params.value}
                        </Typography>
                    </Tooltip>
                ),
            },
            {
                field: "details",
                headerName: "Details",
                flex: 2,
                minWidth: 280,
                renderCell: (params) => (
                    <Tooltip title={params.value || "-"} arrow>
                        <Typography variant="body2" noWrap>
                            {params.value}
                        </Typography>
                    </Tooltip>
                ),
            },
            {
                field: "reference",
                headerName: "Reference",
                flex: 1,
                minWidth: 140,
            },
        ],
        []
    );

    useEffect(() => {
        if (isError) {
            enqueueSnackbar(error?.response?.data?.message || "Failed to load audit logs", {
                variant: "error",
            });
        }
    }, [isError, error, enqueueSnackbar]);

    const total = data?.pagination?.total ?? 0;

    return (
        <div className="w-full bg-gray-50 p-1 md:p-5">
            <div className="max-w-8xl mx-auto space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-2xl font-bold text-gray-900 pl-2">Audit Trails</h1>
                    <p className="text-gray-600 text-sm md:text-base pl-2">
                        Human readable activity history with clear who, what, and when details
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={`Total logs: ${total}`} variant="outlined" />
                            <Chip size="small" label="Readable view" color="primary" variant="outlined" />
                        </Stack>
                        <div className="text-xs text-slate-500">
                            {isFetching && !isLoading ? "Updating..." : ""}
                        </div>
                    </div>

                    <Box sx={{ height: "calc(100vh - 300px)", width: "100%" }}>
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
                                const pageChanged = model.page !== page;
                                const sizeChanged = model.pageSize !== pageSize;

                                if (sizeChanged) {
                                    setPage(0);
                                    setPageSize(model.pageSize);
                                    return;
                                }

                                if (pageChanged) {
                                    setPage(model.page);
                                }
                            }}
                            disableRowSelectionOnClick
                            getRowId={(row) => row.id}
                            sx={{
                                border: "none",
                                "& .MuiDataGrid-columnHeaders": {
                                    backgroundColor: "#f8fafc",
                                    borderBottom: "1px solid #e2e8f0",
                                },
                                "& .MuiDataGrid-cell": {
                                    alignItems: "center",
                                },
                            }}
                        />
                    </Box>
                </div>
            </div>
        </div>
    );
}
