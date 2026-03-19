import React, { useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Box, Typography } from "@mui/material";

export default function StudentTransactionsGrid({ data, isLoading }) {
  const student = data?.student;
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const limit = data?.limit ?? 10;
  const totalPages = data?.totalPages ?? 0;

  const rows = useMemo(() => {
    const tx = data?.transactions ?? [];
    return tx.map((t, idx) => ({
      id: t?._id ?? `${page}-${idx}`, // ✅ DataGrid requires unique id
      sno: (page - 1) * limit + (idx + 1),
      transactionId: t?.transaction_id ?? t?._id ?? "-",
      date: t?.createdAt ? new Date(t.createdAt).toLocaleString() : "-",
      type: t?.type ?? "-",
      amount: t?.amount ?? "-",
      status: t?.status ?? "-",
      remarks: t?.remarks ?? "-",
      raw: t,
    }));
  }, [data, page, limit]);

  const columns = useMemo(
    () => [
      { field: "sno", headerName: "#", width: 80 },
      { field: "transactionId", headerName: "Transaction Id", flex: 1, minWidth: 180 },
      { field: "date", headerName: "Date", flex: 1, minWidth: 200 },
      { field: "type", headerName: "Type", width: 120 },
      { field: "amount", headerName: "Amount", width: 120 },
      { field: "status", headerName: "Status", width: 140 },
      { field: "remarks", headerName: "Remarks", flex: 1, minWidth: 220 },
    ],
    []
  );

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {student?.name
              ? `${student.name} (${student.registration_number})`
              : "-"}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Total: <b>{total}</b> | Page: <b>{page}</b> / <b>{totalPages || 1}</b>
        </Typography>
      </Box>

      {/* DataGrid */}
      <Box sx={{ height: 520, bgcolor: "background.paper", borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          paginationMode="client"
          pageSizeOptions={[5, 10, 20, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: limit, page: 0 } },
          }}
          sx={{
            border: 1,
            borderColor: "divider",
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f9fafb" },
          }}
        />
      </Box>
    </Box>
  );
}
