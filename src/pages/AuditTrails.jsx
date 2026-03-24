import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import { DataGrid } from "@mui/x-data-grid";
import { Box } from "@mui/material";
import { useAuditLogsQuery } from "../hooks/useAuditLogsQuery";

export default function AuditTrails() {
    const { enqueueSnackbar } = useSnackbar();

    // DataGrid uses 0-based page index
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // API uses 1-based page
    const apiPage = page + 1;

    const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery({
        page: apiPage,
        limit: pageSize,
    });

    // ✅ rows exactly like your old table
    const rows = useMemo(() => {
        const list = data?.data ?? [];
        return list.map((item, idx) => ({
            id: item._id ?? `${apiPage}-${idx}`,
            username: item?.username || "-",
            targetModel: item?.targetModel || "-",
            description: item?.description || "-",
            action: item?.action || "-",
            inmateId: item?.changes?.inmateId || "-",
            custodyType: item?.changes?.custodyType || "",
            status: item?.changes?.status || "-",
        }));
    }, [data, apiPage]);

    const columns = useMemo(
        () => [
            { field: "username", headerName: "User Name", flex: 1, minWidth: 140 },
            { field: "targetModel", headerName: "Target Model", flex: 1, minWidth: 140 },
            { field: "description", headerName: "Description", flex: 2, minWidth: 200 },
            { field: "action", headerName: "Actions", flex: 1, minWidth: 120 },
            {
                field: "inmateId",
                headerName: "Inmate ID",
                flex: 1,
                minWidth: 120,
                renderCell: (params) => {
                    const inmate = params.row;
                    console.log(inmate);
                    
                    return (
                        <div>
                            {inmate?.inmateId || '-'}{" "}
                            {inmate?.custodyType && (
                                <>
                                    - <span className="text-red-400">{inmate.custodyType}</span>
                                </>
                            )}
                        </div>
                    );
                },
                sortable: false,
            },
            { field: "status", headerName: "Status", flex: 1, minWidth: 140 },
        ],
        []
    );

    // ✅ show error once (not on every render)
    useEffect(() => {
        if (isError) {
            enqueueSnackbar(error?.response?.data?.message || "Failed to load audit logs", {
                variant: "error",
            });
        }
    }, [isError, error, enqueueSnackbar]);

    // ✅ Use your backend pagination total (same as table)
    const total = data?.pagination?.total ?? 0;

    return (
        <div className="w-full bg-gray-50 p-1 md:p-5">
            <div className="max-w-8xl mx-auto space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-2xl font-bold text-gray-900 pl-2">Audit Trails</h1>
                    <p className="text-gray-600 text-sm md:text-base pl-2">
                        Monitor system statistics and recent activities
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow p-4">
                    <div className="flex items-center justify-between mb-3">
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
                        />

                    </Box>
                </div>
            </div>
        </div>
    );
}
