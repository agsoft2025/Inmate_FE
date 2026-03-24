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

  const inmateRows = useMemo(() => {
    const list = data?.data || [];
    return list.map((inmate) => ({
      id: inmate._id,                         // ✅ DataGrid needs id
      inmateId: inmate.inmateId || "-",
      fullName: `${inmate.firstName || ""} ${inmate.lastName || ""}`.trim() || "-",
      phonenumber: inmate.phonenumber || "-",
      custodyType: inmate.custodyType || "-",
      cellNumber: inmate.cellNumber || "-",
      balance: inmate.balance ?? 0,
      status: inmate.status || "-",
      createdAt: inmate.createdAt,

      // keep original if you need it in edit modal
      raw: inmate,
    }));
  }, [data]);


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
      { field: "inmateId", headerName: "Inmate ID", width: 130 },

      { field: "fullName", headerName: "Name", flex: 1, minWidth: 180 },

      { field: "phonenumber", headerName: "Mobile No", width: 160 },

      { field: "custodyType", headerName: "UT/CT/RP", width: 160 },

      { field: "cellNumber", headerName: "Cell Number", width: 140 },

      {
        field: "balance",
        headerName: "Balance",
        width: 130,
        renderCell: (params) => {
          const val = Number(params.value ?? 0);
          return (
            <span className={`font-semibold ${val > 0 ? "text-green-700" : "text-red-600"}`}>
              ₹{val}
            </span>
          );
        },
      },

      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderCell: (params) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${params.value === "active"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
              }`}
          >
            {params.value || "-"}
          </span>
        ),
      },

      {
        field: "createdAt",
        headerName: "Created",
        width: 190,
        renderCell: (params) => <span>{formatDate(params.value)}</span>,
      },

      {
        field: "action",
        headerName: "Action",
        width: 140,
        sortable: false,
        filterable: false,
        align: "center",
        renderCell: (params) => (
          <div className="flex items-center justify-center h-full w-full gap-3">
            <button
              onClick={() => {
                setOpen(true);
                setSelectedStudent(params.row.raw);
              }}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#1976d2" }}
            >
              <Edit />
            </button>

            <button
              onClick={() => {
                setSelectedStudent(params.row);  // ✅ store the row (has id)
                setDeleteOpen(true);            // ✅ open modal
              }}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "red" }}
            >
              <Trash2 />
            </button>
          </div>
        ),
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
              <p className="text-gray-600 text-sm">Manage student profiles and demographics</p>
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
