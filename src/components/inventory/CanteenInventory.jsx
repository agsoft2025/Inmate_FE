import React, { useMemo, useState } from "react";
import { Box, Button as MUIButton, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Edit, Plus, Trash2, PackageSearch } from "lucide-react";
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";

import CanteenModal from "./CanteenModal";
import TransferModal from "./TransferModal";
import StoreInventoryDialog from "./StoreInventoryDialog";

import useDebounce from "../../hooks/useDebounce";
import { useCanteenInventoryQuery, useDeleteCanteenItemMutation } from "../../hooks/useInventoryQuery";
import { generateReport } from "../../service/reportService";

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.data?.message ||
  err?.message ||
  "Something went wrong";

// ---- Commissary Demand Forecasting ------------------------------------
// Reuses the existing "reports/tuckshop-sales-report" endpoint (already
// wired up via generateReport/useGenerateReportMutation elsewhere in the
// app) to pull recent canteen sales, then estimates how many days of
// stock each item has left based on its recent sell-through rate.
const REORDER_LOOKBACK_DAYS = 30; // matches the "1monthago" report window
const REORDER_COVERAGE_DAYS = 7; // flag items with < 1 week of stock left
const REORDER_TARGET_COVERAGE_DAYS = 30; // suggested qty restocks to ~30 days of runway
const FALLBACK_REORDER_QTY = 10; // used only when demand can't be estimated at all (e.g. 0 stock, no sales history)

// The sales report only returns each line item's product name (not its
// itemNo - the backend populate doesn't select it), so itemName is the
// best available join key back to the canteen grid rows.
const buildDemandByItemName = (salesLines) => {
  const totals = new Map();
  if (!Array.isArray(salesLines)) return totals;

  salesLines.forEach((line) => {
    const name = line?.productName;
    if (!name) return;
    const qty = Number(line.quantity) || 0;
    totals.set(name, (totals.get(name) || 0) + qty);
  });

  return totals;
};

// Determines whether an item should show a "Reorder Suggested" badge, and
// if so, how much to suggest reordering (enough to cover ~30 days at the
// recent sell-through rate). Never places/triggers an order on its own -
// this is a read-only recommendation the user reviews before submitting.
const getReorderStatus = (row, demandByItemName, hasSalesData) => {
  const currentStock = Number(row?.stockQuantity);

  if (!Number.isFinite(currentStock)) {
    return { status: "insufficient", daysOfStock: null, suggestedReorderQty: null };
  }

  const totalSold = hasSalesData ? demandByItemName.get(row.itemName) || 0 : 0;
  const avgDailyDemand = totalSold > 0 ? totalSold / REORDER_LOOKBACK_DAYS : 0;

  if (currentStock <= 0) {
    // Out of stock always needs a reorder, even without demand history -
    // fall back to a flat starter quantity for staff to adjust.
    const suggestedReorderQty =
      avgDailyDemand > 0
        ? Math.max(1, Math.ceil(avgDailyDemand * REORDER_TARGET_COVERAGE_DAYS))
        : FALLBACK_REORDER_QTY;
    return { status: "reorder", daysOfStock: 0, suggestedReorderQty };
  }

  if (!hasSalesData || totalSold <= 0) {
    // No sales recorded for this item in the lookback window - not enough
    // consumption history to forecast demand for it specifically.
    return { status: "insufficient", daysOfStock: null, suggestedReorderQty: null };
  }

  const daysOfStock = currentStock / avgDailyDemand;
  if (daysOfStock > REORDER_COVERAGE_DAYS) {
    return { status: "ok", daysOfStock, suggestedReorderQty: null };
  }

  const targetStock = Math.ceil(avgDailyDemand * REORDER_TARGET_COVERAGE_DAYS);
  const suggestedReorderQty = Math.max(1, targetStock - Math.floor(currentStock));

  return { status: "reorder", daysOfStock, suggestedReorderQty };
};

function CanteenInventory() {
  const [page, setPage] = useState(0); // DataGrid is 0-based
  const [pageSize, setPageSize] = useState(10);

  const [open, setOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Reorder Suggested workflow: reuses StoreInventoryDialog's existing
  // "Add Store Inventory" create flow - clicking the badge just opens it
  // with one line item pre-filled. Nothing is submitted automatically.
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderPrefillItems, setReorderPrefillItems] = useState(null);

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

  // Commissary Demand Forecasting: pull the last 30 days of canteen sales
  // (existing report endpoint) to estimate reorder need per item. Missing
  // data (no sales yet, report returns nothing) is handled gracefully -
  // affected items just show "Insufficient Data" instead of a guess.
  const {
    data: salesReportRes,
    isLoading: isSalesReportLoading,
  } = useQuery({
    queryKey: ["canteen-sales-report", REORDER_LOOKBACK_DAYS],
    queryFn: () =>
      generateReport({
        url: "reports/tuckshop-sales-report",
        payload: { dateRange: "1monthago" },
      }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false, // a 404 here just means "no sales yet" - not worth retrying
  });

  const hasSalesData = Array.isArray(salesReportRes?.data);
  const demandByItemName = useMemo(
    () => buildDemandByItemName(salesReportRes?.data),
    [salesReportRes]
  );

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

  // Open StoreInventoryDialog's Create flow with this item pre-filled at
  // the recommended reorder quantity. The user still reviews/edits every
  // field and must explicitly hit "Create" - nothing is ordered here.
  const handleReorderClick = (row, suggestedReorderQty) => {
    setReorderPrefillItems([
      {
        itemName: row.itemName || "",
        itemNo: row.itemNo || "",
        stock: suggestedReorderQty || "",
        sellingPrice: row.price || "",
        category: row.category || "",
        status: "Active",
        itemID: "",
      },
    ]);
    setReorderDialogOpen(true);
  };

  const handleReorderDialogOpenChange = (isOpen) => {
    setReorderDialogOpen(isOpen);
    if (!isOpen) setReorderPrefillItems(null);
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
        field: "reorderSuggested",
        headerName: "Reorder Suggested",
        width: 190,
        sortable: false,
        filterable: false,
        headerAlign: "center",
        align: "center",
        renderCell: (params) => {
          if (isSalesReportLoading) {
            return <span className="text-xs text-slate-400">Checking…</span>;
          }

          const { status, daysOfStock, suggestedReorderQty } = getReorderStatus(
            params.row,
            demandByItemName,
            hasSalesData
          );

          if (status === "insufficient") {
            return (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500"
                title="Not enough sales history to forecast demand for this item"
              >
                Insufficient Data
              </span>
            );
          }

          if (status === "reorder") {
            const tooltip =
              (daysOfStock === 0
                ? "Item is out of stock. "
                : `~${Math.floor(daysOfStock)} day(s) of stock left based on last ${REORDER_LOOKBACK_DAYS} days of sales. `) +
              `Click to start a reorder (suggested qty: ${suggestedReorderQty}).`;

            return (
              <button
                type="button"
                onClick={() => handleReorderClick(params.row, suggestedReorderQty)}
                title={tooltip}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition cursor-pointer"
              >
                <PackageSearch className="w-3.5 h-3.5" />
                Reorder Suggested
              </button>
            );
          }

          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"
              title={`~${Math.floor(daysOfStock)} day(s) of stock left based on last ${REORDER_LOOKBACK_DAYS} days of sales`}
            >
              Stock OK
            </span>
          );
        },
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
    [deleteMutation.isPending, demandByItemName, hasSalesData, isSalesReportLoading]
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

      {/* Reorder Suggested workflow: same "Add Store Inventory" dialog and
          submission flow used by Store Inventory, just opened with a
          pre-filled line item. selectedData is always null here so this
          stays a "create" (POST), never an edit. */}
      <StoreInventoryDialog
        open={reorderDialogOpen}
        setOpen={handleReorderDialogOpenChange}
        selectedData={null}
        initialItems={reorderPrefillItems}
      />
    </Box>
  );
}

export default CanteenInventory;
