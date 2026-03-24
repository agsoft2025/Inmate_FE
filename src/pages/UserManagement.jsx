import { Edit, Plus, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useDeleteUserMutation, useUsersQuery } from '../hooks/useUsersQuery';
import { Box, Chip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ConfirmDeleteDialog from '../components/commonModals/ConfirmDeleteDialog';
import UserFormDialog from '../components/user/UserFormDialog';
import FaceRecognition from '../components/faceIdComponent/FaceID';

const UserManagement = () => {

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [faceidModalOpen, setFaceidModalOpen] = useState(false);
    const [faceIdData, setFaceIdData] = useState(null);

    const deleteMutation = useDeleteUserMutation();

    const { data, isLoading, isFetching } = useUsersQuery({
        page: page + 1,     // API expects 1-based page
        limit: pageSize,
    });

    const rows = data?.data ?? [];

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setDeleteOpen(true);
    };

    const closeDeleteModal = () => {
        setDeleteOpen(false);
        setSelectedUser(null);
    };

    const confirmDelete = async () => {
        if (!selectedUser?._id) return;
        try {
            await deleteMutation.mutateAsync(selectedUser._id);
            setDeleteOpen(false);
            enqueueSnackbar("User deleted successfully", { variant: "success" });

            closeDeleteModal();
        } catch (error) {
            enqueueSnackbar(
                error?.response?.data?.message || "Failed to delete user",
                { variant: "error" }
            );
        }
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setOpen(true);
    }

    const columns = useMemo(
        () => [
            { field: "username", headerName: "Username", flex: 1, minWidth: 130 },
            { field: "fullname", headerName: "Full Name", flex: 1.2, minWidth: 160 },
            {
                field: "role",
                headerName: "Role",
                flex: 0.8,
                minWidth: 120,
                renderCell: (params) => (
                    <Chip
                        size="small"
                        label={params.value}
                        variant="outlined"
                        sx={{ textTransform: "capitalize" }}
                    />
                ),
            },
            {
                field: "createdAt",
                headerName: "Created",
                flex: 1,
                minWidth: 180,
                valueFormatter: (value) => {
                    if (!value) return "-";
                    const d = new Date(value);
                    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN");
                },
            },
            {
                field: "updatedAt",
                headerName: "Updated",
                flex: 1,
                minWidth: 180,
                valueFormatter: (value) => {
                    if (!value) return "-";
                    const d = new Date(value);
                    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN");
                },
            },
            {
                field: "actions",
                headerName: "Actions",
                width: 140,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                align: "center",
                headerAlign: "center",
                renderCell: (params) => (
                    
                    <div className="flex items-center justify-center h-full w-full gap-3">
                        <button
                            onClick={() => handleEdit(params.row)}
                            className={`text-blue-600 hover:text-blue-800 cursor-pointer ${params.row.role === "INMATE" ? "text-gray-600" : ""}`}
                            disabled={params.row.role === "INMATE"}
                        >
                            <Edit size={18} />
                        </button>

                        <button
                            onClick={() => openDeleteModal(params.row)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ),
            }

        ],
        []
    );

    return (
        <div className='p-2 md:p-6'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center m-3 md:m-0'>
                <div>
                    <h1 className='text-2xl text-primary font-bold'>User Management</h1>
                    <h3>Monitor Users</h3>
                </div>
                <button className='bg-primary px-4 py-2 text-white rounded-md flex items-center gap-3 mx-auto md:mx-0'
                    onClick={() => { setSelectedUser(null); setOpen(true) }}
                >
                    <Plus />
                    Add user</button>
            </div>

            <Box sx={{ height: "calc(100vh - 260px)", width: "100%" }} className="bg-white rounded-2xl shadow-sm mt-3">
                <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(row) => row._id}
                    loading={isLoading || isFetching}
                    pagination
                    paginationMode="server"
                    rowCount={data?.totalItems ?? 0} // ✅ MUST come from backend
                    paginationModel={{ page, pageSize }}
                    onPaginationModelChange={(model) => {
                        setPage(model.page);
                        setPageSize(model.pageSize);
                    }}
                    pageSizeOptions={[10, 20, 50]}
                    disableRowSelectionOnClick
                    sx={{
                        border: "none",
                        "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f9fafb" },
                    }}
                />

            </Box>

            <ConfirmDeleteDialog
                open={deleteOpen}
                title="Delete User"
                description="Are you sure you want to delete this user? This action cannot be undone."
                itemName={selectedUser?.fullname}
                subText={selectedUser?.username}
                onClose={closeDeleteModal}
                onConfirm={confirmDelete}
                loading={deleteMutation.isPending}
            />

            <UserFormDialog
                open={open}
                onClose={() => {setSelectedUser(null); setOpen(false);  }}
                selectedUser={selectedUser}
                setFaceidModalOpen={setFaceidModalOpen}
                faceIdData={faceIdData}
                setSelectedUser={setSelectedUser}
            />

            {/* Face ID Modal */}
            {faceidModalOpen && (
                <FaceRecognition mode="register" open={faceidModalOpen} setOpen={setFaceidModalOpen} faceIdData={faceIdData} setFaceIdData={setFaceIdData} setSelectedUser={setSelectedUser} />
            )}
        </div>
    )
}

export default UserManagement