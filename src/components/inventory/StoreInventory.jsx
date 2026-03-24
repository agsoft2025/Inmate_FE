import React, { useMemo, useState } from "react";
import { Box, Button, IconButton, TextField, Paper, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format } from "date-fns";
import { useSnackbar } from "notistack";
import { Edit, Plus, Trash2 } from "lucide-react";

import useDebounce from "../../hooks/useDebounce";
import { useDeleteInventoryMutation, useInventoryQuery } from "../../hooks/useInventoryQuery";
import StoreInventoryDialog from "./StoreInventoryDialog";

function StoreInventory() {
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [open, setOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);

  const [refetchKey, setRefetchKey] = useState(0);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const queryParams = useMemo(() => {
    const start = startDate ? format(new Date(startDate), "yyyy-MM-dd") : "";
    const end = endDate ? format(new Date(endDate), "yyyy-MM-dd") : "";

    return {
      page: page + 1,
      limit: pageSize,
      search: debouncedSearch || "",
      startDate: start && end ? start : "",
      endDate: start && end ? end : "",
      refetchKey,
    };
  }, [page, pageSize, debouncedSearch, startDate, endDate, refetchKey]);

  const { data: apiRes, isLoading, isFetching, error } = useInventoryQuery(queryParams);

  const list = apiRes?.data || apiRes || [];
  const totalCount = apiRes?.total || apiRes?.count || 0;

  const rows = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    return arr.map((record, idx) => {
      const vp = record?.vendorPurchase || {};
      return {
        id: vp?._id || record?._id || idx,
        sno: page * pageSize + idx + 1,
        date: vp?.date || "",
        invoiceNo: vp?.invoiceNo || "",
        vendorName: vp?.vendorName || "",
        gatePassNumber: vp?.gatePassNumber || "",
        vendorValue: vp?.vendorValue ?? "",
        items: record?.items || [],
        _raw: record,
      };
    });
  }, [list, page, pageSize]);

  const deleteMutation = useDeleteInventoryMutation();

  const deleteItem = async (id) => {
    try {
      const res = await deleteMutation.mutateAsync(id);
      enqueueSnackbar(res?.message || res?.data?.message || "Deleted successfully", { variant: "success" });
      setRefetchKey((p) => p + 1);
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || "Delete failed", { variant: "error" });
    }
  };

  const columns = useMemo(
    () => [
      { field: "sno", headerName: "S.NO", width: 70, align: "center", headerAlign: "center", sortable: false },
      {
        field: "date",
        headerName: "Date",
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (params.value ? new Date(params.value).toLocaleDateString() : "-"),
      },
      { field: "invoiceNo", headerName: "Invoice", width: 140, align: "center", headerAlign: "center" },
      { field: "vendorName", headerName: "Vendor", width: 170, align: "center", headerAlign: "center" },
      { field: "gatePassNumber", headerName: "GP Number", width: 140, align: "center", headerAlign: "center" },
      { field: "vendorValue", headerName: "Amount", width: 140, align: "center", headerAlign: "center" },
      {
        field: "stocks",
        headerName: "Stocks",
        width: 140,
        sortable: false,
        headerAlign: "center",
        renderCell: (params) => (
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", width: "100%", textAlign: "center" }}>
            {(params.row?.items || []).map((it) => (
              <Typography key={it._id} variant="body2">
                {it.stock}
              </Typography>
            ))}
          </Box>
        ),
      },
      {
        field: "itemsCol",
        headerName: "Items",
        width: 240,
        sortable: false,
        headerAlign: "center",
        renderCell: (params) => (
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", width: "100%", textAlign: "center" }}>
            {(params.row?.items || []).map((it) => (
              <Typography key={it._id} variant="body2">
                {it.itemName}
              </Typography>
            ))}
          </Box>
        ),
      },
      {
        field: "mrp",
        headerName: "MRP",
        width: 140,
        sortable: false,
        headerAlign: "center",
        renderCell: (params) => (
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", width: "100%", textAlign: "center" }}>
            {(params.row?.items || []).map((it) => (
              <Typography key={it._id} variant="body2">
                {it.sellingPrice}
              </Typography>
            ))}
          </Box>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        filterable: false,
        headerAlign: "center",
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => {
                setSelectedData(params.row._raw);
                setOpen(true);
              }}
            >
              <Edit size={18} />
            </IconButton>

            <IconButton size="small" onClick={() => deleteItem(params.row.id)} disabled={deleteMutation.isPending}>
              <Trash2 size={18} />
            </IconButton>
          </Box>
        ),
      },
    ],
    [deleteMutation.isPending]
  );

  return (
    <Box sx={{ width: "100%", bgcolor: "#f9fafb", p: { xs: 1.5, sm: 2, md: 3 } }}>
      {/* IMPORTANT: no maxWidth wrapper here */}
      <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Top Bar - responsive */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <div className="flex flex-col md:flex-row gap-2">
            <TextField
              label="Search"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, width: "100%" }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(v) => setStartDate(v)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </Box>
            </LocalizationProvider>

            {error ? (
              <Typography color="error" variant="body2">
                {error?.response?.data?.message || error?.message || "Failed to load"}
              </Typography>
            ) : null}
          </div>

          <Button
            variant="contained"
            onClick={() => {
              setOpen(true);
              setSelectedData(null);
            }}
            startIcon={<Plus size={18} />}
            sx={{ width: { xs: "100%", md: "auto" }, flexShrink: 0 }}
          >
            Create Inventory
          </Button>
        </Box>

        {/* DataGrid wrapper (horizontal scroll on small screens) */}
        <Paper variant="outlined" sx={{ width: "100%", borderRadius: 2, overflow: "hidden" }}>
          <Box
            sx={{
              width: "100%",
              overflowX: "auto", // ✅ mobile scroll
            }}
          >
            <Box sx={{ minWidth: 980 }}>
              <DataGrid
                rows={rows}
                columns={columns}
                loading={isLoading || isFetching}
                pagination
                paginationMode="server"
                rowCount={totalCount}
                pageSizeOptions={[5, 10, 20, 50]}
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={(model) => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                disableRowSelectionOnClick
                autoHeight
                sx={{
                  border: 0,
                  "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f9fafb" },
                }}
              />
            </Box>
          </Box>
        </Paper>
      </Box>

      <StoreInventoryDialog open={open} setOpen={setOpen} selectedData={selectedData} />
    </Box>
  );
}

export default StoreInventory;
