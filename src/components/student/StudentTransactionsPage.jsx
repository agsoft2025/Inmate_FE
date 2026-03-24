import React, { useMemo, useState } from "react";
import { Box } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useStudentTransactions } from "../../hooks/useStudentExactQuery";
import { useAuth } from "../../context/AuthContext";

export default function StudentTransactionsTable() {
  const { user } = useAuth();
  const regNo = user?.username;
  // ✅ DataGrid uses 0-based page
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ✅ API expects 1-based page
  const apiPage = page + 1;

  const { data, isLoading, isFetching } = useStudentTransactions(
    regNo,
    apiPage,
    pageSize
  );
console.log(data);

  const total = data?.count ?? 0;
  const transactions = data?.transactions ?? [];

  // ⚠️ Adjust these fields based on actual transaction object keys
  const rows = useMemo(() => {
    return transactions.map((t, idx) => ({
      id: t?._id ?? `${apiPage}-${idx}`, // ✅ required
      sno: (apiPage - 1) * pageSize + (idx + 1),
      transactionId: t?.transaction_id ?? t?._id ?? "-",
      date: t?.createdAt ? new Date(t.createdAt).toLocaleString() : "-",
      type: t?.type ?? "-",
      amount: t?.amount ?? "-",
      status: t?.status ?? "-",
      remarks: t?.remarks ?? "-",
    }));
  }, [transactions, apiPage, pageSize]);

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
          setPage(model.page);
        }}
        disableRowSelectionOnClick
        sx={{
          "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f8fafc" },
        }}
      />
    </Box>
  );
}
