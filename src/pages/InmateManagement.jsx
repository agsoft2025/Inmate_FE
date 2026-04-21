import { useEffect, useMemo, useState } from "react";
import { Box, TextField, InputAdornment } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { useSnackbar } from "notistack";

import useDebounce from "../hooks/useDebounce";
import { useDeleteStudentMutation, useStudentsQuery } from "../hooks/useStudentExactQuery";
import DummyProfile from "../assets/dummy.png";
import { formatDate } from "../hooks/useFormatDate";
import ConfirmDeleteDialog from "../components/commonModals/ConfirmDeleteDialog";

// ✅ Face Component (render in parent)
import FaceRecognition from "../components/faceIdComponent/FaceID";
import InmateFormModal from "../components/student/StudentFormModal";

export default function InmateManagement() {
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [faceidModalOpen, setFaceidModalOpen] = useState(false);
  const [faceIdData, setFaceIdData] = useState(null);

  const apiPage = page + 1;

  const deleteStudentMutation = useDeleteStudentMutation();
  const { data, isLoading, isFetching } = useStudentsQuery({
    search: debouncedSearch,
    page: apiPage,
    limit: pageSize,
  });
  const total = data?.totalItems ?? 0;
  const transactions = data?.transactions ?? [];

  const inmateRows = useMemo(() => {
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


  const handleEdit = (row) => {
    setSelectedStudent(row);
    setOpen(true);
  };

  const openDeleteModal = (row) => {
    setSelectedStudent(row);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setSelectedStudent(null);
  };

  const confirmDelete = async () => {
    if (!selectedStudent?.id) return;

    try {
      await deleteStudentMutation.mutateAsync(selectedStudent.id);
      enqueueSnackbar("Student deleted successfully", { variant: "success" });
      closeDeleteModal();
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || "Delete failed", { variant: "error" });
    }
  };

      const inmateColumns = useMemo(
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


  return (
    <div className="w-full bg-gray-50 overflow-x-hidden">
      <div className="px-3 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="max-w-8xl mx-auto space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inmate Management</h1>
              <p className="text-gray-600 text-sm">Manage Inmate profiles and demographics</p>
              <p className="text-xs text-slate-500">{isFetching && !isLoading ? "Updating..." : ""}</p>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
              <TextField
                size="small"
                placeholder="Search inmate ID"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 320 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} />
                    </InputAdornment>
                  ),
                }}
              />

              <button
                className="bg-primary p-2 px-4 text-white rounded-md flex items-center gap-2"
                onClick={() => {
                  setSelectedStudent(null);
                  setOpen(true);
                }}
              >
                <Plus /> Add Inmate
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-3">
            <Box sx={{ height: "calc(100vh - 260px)", width: "100%" }}>
              <DataGrid
                rows={inmateRows}
                columns={inmateColumns}
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
          </div>
        </div>
      </div>

      <InmateFormModal
        open={open}
        onClose={() => { setOpen(false); setSelectedStudent(null); }}
        selectedInmate={selectedStudent}
        DummyProfile={DummyProfile}
        faceidModalOpen={faceidModalOpen}
        setFaceidModalOpen={setFaceidModalOpen}
        faceIdData={faceIdData}
        setFaceIdData={setFaceIdData}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete Student"
        description="Are you sure you want to delete this user? This action cannot be undone."
        itemName={selectedStudent?.student_name}
        subText={selectedStudent?.registration_number}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        loading={deleteStudentMutation.isPending}
      />

      {/* Face Recognition Component */}
      {faceidModalOpen && (
        <FaceRecognition mode="register" open={faceidModalOpen} setOpen={setFaceidModalOpen} faceIdData={faceIdData} setFaceIdData={setFaceIdData} />
      )}
    </div>
  );
}
