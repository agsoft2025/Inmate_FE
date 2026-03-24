import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
} from "@mui/material";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";
import { useDeleteFaceRecognitionMutation, useUserByIdQuery, useUserMutation } from "../../hooks/useUsersQuery";
import { useLocationCtx } from "../../context/LocationContext";
import { Camera, Trash2 } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";

const UserFormDialog = ({ open, onClose, selectedUser, setFaceidModalOpen, faceIdData, setSelectedUser }) => {
    const mutation = useUserMutation();
    const { selectedLocation } = useLocationCtx();

    const deleteMutation = useDeleteFaceRecognitionMutation();
    const { data: userById } = useUserByIdQuery(selectedUser?._id);

    const queryClient = useQueryClient();
    const hasFace = useMemo(() => {
        return Array.isArray(userById?.data?.descriptor) && userById?.data?.descriptor.length > 0 || Array.isArray(selectedUser?.descriptor) && selectedUser?.descriptor.length > 0;
    }, [userById?.data?.descriptor, selectedUser?.descriptor]);

    const deleteFaceId = (faceId) => {
        deleteMutation.mutate(faceId, {
            onSuccess: (res) => {
                queryClient.invalidateQueries({ queryKey: ["userById", selectedUser?._id] });
                queryClient.invalidateQueries({ queryKey: ["users"] });
                setSelectedUser((prev) => ({ ...prev, descriptor: [] }));
                enqueueSnackbar(res?.message || "Face deleted successfully", {
                    variant: "success",
                });
            },
            onError: (err) => {
                enqueueSnackbar(
                    err?.response?.data?.message || "Delete failed",
                    { variant: "error" }
                );
            },
        });
    };

    useEffect(() => {
        if (!open && selectedUser?._id) {
            queryClient.removeQueries({ queryKey: ["userById", selectedUser._id] });
            setSelectedUser(null);
        }
    }, [open, selectedUser?._id, queryClient]);


    const userSchema = yup.object({
        fullname: yup.string().required("Full name is required"),
        username: yup.string().required("Username is required"),
        role: yup.string().required("Role is required"),
        ...(selectedUser
            ? {
                oldPassword: yup.string().test(
                    "password-test",
                    "Please enter your current password",
                    function (value) {
                        const { newPassword } = this.parent;
                        return !newPassword || !!value;
                    }
                ),

                newPassword: yup.string()
                    .nullable()
                    .transform((val) => (val === "" ? null : val))
                    .min(6, "Password must be at least 6 characters"),

                confirmPassword: yup.string().test(
                    "password-test",
                    "Passwords must match",
                    function (value) {
                        const { newPassword } = this.parent;
                        return !newPassword || value === newPassword;
                    }
                ),
            }
            : {
                password: yup.string()
                    .required("Password is required")
                    .min(6, "Password must be at least 6 characters"),

                confirmPassword: yup.string()
                    .required("Confirm password is required")
                    .oneOf([yup.ref("password"), null], "Passwords must match"),
            }),
    });
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors },
        getValues,
    } = useForm({
        resolver: yupResolver(userSchema),
        defaultValues: {
            username: "",
            fullname: "",
            role: "",
            password: "",
            confirmPassword: "",
            oldPassword: "",
            newPassword: "",
        },
    });

    // ✅ populate data on edit
    useEffect(() => {
        if (selectedUser) {
            reset({
                fullname: selectedUser.fullname || "",
                username: selectedUser.username || "",
                role: selectedUser.role || "",
            });
        } else {
            reset({
                fullname: "",
                username: "",
                role: "",
            });
        }
    }, [selectedUser, reset]);

    const onSubmit = async (values) => {
        // base payload (common)
        const payload = {
            username: values.username,
            fullname: values.fullname,
            role: values.role,
            locationId: selectedLocation?._id || selectedLocation?.id, // ✅ consistent
            descriptor: faceIdData ? faceIdData : null,
        };

        // ✅ CREATE: password required
        if (!selectedUser) {
            payload.password = values.password;
        }

        // ✅ UPDATE: password change only if newPassword entered
        if (selectedUser && values.newPassword) {
            payload.oldPassword = values.oldPassword;
            payload.newPassword = values.newPassword;
        }

        try {
            await mutation.mutateAsync({
                id: selectedUser?._id,
                payload,
            });
            onClose();
        } catch (err) {
            console.error(err);
        }
    };


    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {selectedUser ? "Edit User" : "Create User"}
            </DialogTitle>

            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent className="grid grid-cols-1 gap-4 mt-2">
                    <TextField
                        label="Full Name"
                        {...register("fullname")}
                        error={!!errors.fullname}
                        helperText={errors.fullname?.message}
                        fullWidth
                    />

                    <TextField
                        label="Username"
                        {...register("username")}
                        error={!!errors.username}
                        helperText={errors.username?.message}
                        fullWidth
                    />

                    <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                            <TextField
                                select
                                label="Role"
                                fullWidth
                                {...field}
                                value={field.value || ""}   // ✅ ensures it updates on reset
                                error={!!errors.role}
                                helperText={errors.role?.message}
                            >
                                <MenuItem value="ADMIN">ADMIN</MenuItem>
                                <MenuItem value="POS">POS</MenuItem>
                            </TextField>
                        )}
                    />

                    {!selectedUser && (
                        <>
                            <TextField
                                label="Password"
                                type="password"
                                {...register("password")}
                                error={!!errors.password}
                                helperText={errors.password?.message}
                            />

                            <TextField
                                label="Confirm Password"
                                type="password"
                                {...register("confirmPassword")}
                                error={!!errors.confirmPassword}
                                helperText={errors.confirmPassword?.message}
                            />
                        </>
                    )}

                    {selectedUser && (
                        <>
                            <TextField
                                label="Current Password"
                                type="password"
                                {...register("oldPassword")}
                                error={!!errors.oldPassword}
                                helperText={errors.oldPassword?.message}
                            />

                            <TextField
                                label="New Password"
                                type="password"
                                {...register("newPassword")}
                                error={!!errors.newPassword}
                                helperText={errors.newPassword?.message}
                            />

                            <TextField
                                label="Confirm New Password"
                                type="password"
                                {...register("confirmPassword")}
                                error={!!errors.confirmPassword}
                                helperText={errors.confirmPassword?.message}
                            />
                        </>
                    )}

                    {/* Face ID Button */}
                    {(getValues()?.role !== "STUDENT" || selectedUser?.role !== "STUDENT") && <div className="mb-4 grid grid-cols-[90%_10%] gap-2 items-center">
                        <Button type="button" onClick={() => setFaceidModalOpen(true)} className="bg-gray-500! text-white! w-full flex! gap-2! items-center!">
                            <Camera />
                            {hasFace ? "Update Face ID" : "Register Face ID"}
                        </Button>
                        <Button type="button" disabled={!hasFace} onClick={() => deleteFaceId(selectedUser?._id)} className="bg-red-500! hover:bg-red-600! text-white! w-full">
                            <Trash2 />
                        </Button>
                    </div>}

                </DialogContent>

                <DialogActions>
                    <Button variant="outlined" color="error" onClick={onClose} disabled={mutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={mutation.isPending}
                        className="bg-primary!"
                    >
                        {mutation.isPending ? "Saving..." : "Save"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default UserFormDialog;
