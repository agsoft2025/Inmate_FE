import React, { useMemo, useState } from "react";
import { Box, Button as MUIButton, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useSnackbar } from "notistack";

import CanteenModal from "./CanteenModal";
import TransferModal from "./TransferModal";

import useDebounce from "../../hooks/useDebounce";
import { useCanteenInventoryQuery, useDeleteCanteenItemMutation } from "../../hooks/useInventoryQuery";

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.data?.message ||
  err?.message ||
  "Something went wrong";

function CanteenInventory() {
  const [page, setPage] = useState(0); // DataGrid is 0-based
  const [pageSize, setPageSize] = useState(10);

  const [open, setOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const queryParams = useMemo(
    () => ({
      page: page + 1, // backend 1-based
      limit: pageSize,
      search: debouncedSearch || "",
    }),
    [page, pageSize, debouncedSearch]
  );

  const {
    data: apiRes,
    isLoading,
    isFetching,
    error,
  } = useCanteenInventoryQuery(queryParams);

  // adapt to your backend response shape
  const list = apiRes?.data || apiRes || [];
  const totalCount = apiRes?.total || apiRes?.count || list?.length || 0;

  const deleteMutation = useDeleteCanteenItemMutation();

  const deleteItem = async (idOrItemNo) => {
    try {
      const res = await deleteMutation.mutateAsync(idOrItemNo);
      enqueueSnackbar(res?.message || res?.data?.message || "Deleted successfully", {
        variant: "success",
      });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: "error" });
    }
  };

  // ✅ flatten rows for DataGrid (stable + no valueGetter issues)
  const rows = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    return arr.map((item, idx) => ({
      ...item,
      id: item?._id || item?.itemNo || `${page}-${idx}`, // DataGrid needs id
      sno: page * pageSize + idx + 1,
    }));
  }, [list, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        field: "sno",
        headerName: "S.NO",
        width: 70,
        align: "center",
        headerAlign: "center",
        sortable: false,
      },
      {
        field: "itemName",
        headerName: "Item Name",
        flex: 1,
        minWidth: 180,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "price",
        headerName: "Price",
        width: 120,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => `₹${params.value ?? 0}`,
      },
      {
        field: "stockQuantity",
        headerName: "Stock Qty",
        width: 130,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "category",
        headerName: "Category",
        width: 140,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "itemNo",
        headerName: "Item No",
        width: 140,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => (
          <Typography
            fontWeight={700}
            sx={{ color: params.value === "Active" ? "success.main" : "error.main" }}
          >
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "totalQty",
        headerName: "Total Stock",
        width: 130,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        sortable: false,
        filterable: false,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "center" }}>
            <MUIButton
              variant="text"
              size="small"
              onClick={() => {
                setSelectedData(params.row);
                setOpen(true);
              }}
            >
              <Edit size={18} />
            </MUIButton>

            <MUIButton
              variant="text"
              size="small"
              onClick={() => deleteItem(params.row.itemNo)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={18} />
            </MUIButton>
          </Box>
        ),
      },
      {
        field: "transfer",
        headerName: "Transfer",
        width: 140,
        sortable: false,
        filterable: false,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => (
          <MUIButton
            variant="contained"
            size="small"
            color="error"
            onClick={() => {
              setSelectedData(params.row);
              setTransferModalOpen(true);
            }}
          >
            Transfer
          </MUIButton>
        ),
      },
    ],
    [deleteMutation.isPending]
  );

  return (
    <Box className="w-full bg-gray-50 p-4 md:p-6 lg:p-8">
      <Box className="max-w-8xl mx-auto space-y-4">
        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} className="flex-col md:flex-row">
          <TextField
            label="Search"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 280 }}
          />

          <MUIButton
            variant="contained"
            onClick={() => setOpen(true)}
            startIcon={<Plus className="w-4 h-4" />}
          >
            Create Canteen Item
          </MUIButton>
        </Box>

        {error ? (
          <Typography color="error" variant="body2">
            {getErrorMessage(error)}
          </Typography>
        ) : null}

        <Box sx={{ height: 500, width: "100%", bgcolor: "white", borderRadius: 2 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={isLoading || isFetching}
            disableRowSelectionOnClick
            pagination
            paginationMode="server"
            rowCount={totalCount}
            pageSizeOptions={[5, 10, 20, 50]}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            sx={{
              border: "1px solid #e5e7eb",
              "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f9fafb" },
              "& .MuiDataGrid-cell": {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              },
              "& .MuiDataGrid-cell[data-field='itemName']": {
                justifyContent: "flex-start",
              },
            }}
          />
        </Box>
      </Box>

      <CanteenModal
        open={open}
        setOpen={setOpen}
        selectedItem={selectedData}
        setSelectedItem={setSelectedData}
      />

      <TransferModal
        open={transferModalOpen}
        setOpen={setTransferModalOpen}
        selectedItem={selectedData}
        setSelectedItem={setSelectedData}
      />
    </Box>
  );
}

export default CanteenInventory;
