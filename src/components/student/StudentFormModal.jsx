import { useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  Box,
  Typography,
  Button as MuiButton,
  TextField,
  MenuItem,
  Divider,
  Fade,
  Backdrop,
} from "@mui/material";
import { Camera, Trash2 } from "lucide-react";
import { useSnackbar } from "notistack";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import FaceRecognition from "../faceIdComponent/FaceID";
import { useNavigate } from "react-router-dom";
import { useCreateStudentMutation, useUpdateStudentMutation } from "../../hooks/useStudentExactQuery";
import { useLocationCtx } from "../../context/LocationContext";
import { useDeleteFaceRecognitionMutation } from "../../hooks/useUsersQuery";

const toDateInput = (value) => {
  if (!value) return "";

  const d = value instanceof Date ? value : new Date(value);

  // invalid date
  if (Number.isNaN(d.getTime())) return "";

  // treat epoch as "empty" (optional, but helps if your DB already has 1970 saved)
  if (d.getTime() === 0) return "";

  return d.toISOString().slice(0, 10); // yyyy-mm-dd
};
 

const inmateSchema = yup.object({
  inmateId: yup.string().trim().required("Inmate ID is required"),
  status: yup.string().required("Status is required"),
  firstName: yup.string().trim().required("First Name is required"),
  lastName: yup.string().trim().required("Last Name is required"),
  phonenumber: yup
    .string()
    .trim()
    .matches(/^\d{6,14}$/, "Enter a valid phone number")
    .required("Phone Number is required"),

  // ✅ Optional
  custodyType: yup.string().required("Custody Type is required"),
  cellNumber: yup.string().nullable().optional(),

  // ✅ Optional date fields (allow empty string)
  dateOfBirth: yup
    .date()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .max(new Date(), "Future dates are not allowed")
    .test("min-age", "Inmate must be at least 19 years old on the admission date", function (dob) {
      const { admissionDate } = this.parent;
      if (!dob || !admissionDate) return true;

      const admission = new Date(admissionDate);
      const minDate = new Date(admission.getFullYear() - 19, admission.getMonth(), admission.getDate());
      return dob <= minDate;
    })
    .optional(),

  admissionDate: yup
    .date()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .optional(),

  is_blocked: yup.boolean().optional(),
});

export default function InmateFormModal({
  open,
  onClose,
  selectedInmate = null,
  setRefetch,
  refetch,
  faceidModalOpen,
  setFaceidModalOpen,
  faceIdData,
  setFaceIdData,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const createMutation = useCreateStudentMutation();
  const updateMutation = useUpdateStudentMutation();
  const { selectedLocation } = useLocationCtx();

  const isEdit = !!selectedInmate?._id;

  const defaultValues = useMemo(
    () => ({
      inmateId: selectedInmate?.inmateId || "",
      status: selectedInmate?.status || "",
      firstName: selectedInmate?.firstName || "",
      lastName: selectedInmate?.lastName || "",
      custodyType: selectedInmate?.custodyType || "",
      cellNumber: selectedInmate?.cellNumber || "",
      phonenumber: selectedInmate?.phonenumber || "",
      dateOfBirth: toDateInput(selectedInmate?.dateOfBirth) || "",
      admissionDate: toDateInput(selectedInmate?.admissionDate) || "",
      is_blocked: selectedInmate?.is_blocked === "true" ? true : false,
    }),
    [selectedInmate]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(inmateSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // checkbox uses boolean in RHF
  const isBlocked = watch("is_blocked");
  const deleteMutation = useDeleteFaceRecognitionMutation();

  const handleModalClose = useCallback(
    (event, reason) => {
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        onClose?.();
      }
    },
    [onClose]
  );

  const handleClose = () => {
    onClose?.();
    reset(defaultValues);
  };

  const onSubmit = (values) => {
    const payload = {
      ...values,
      class_info: values.class_info,
      pro_pic: values.pro_pic,
      deposite_amount: values?.deposite_amount ?? 0,
      locationId: selectedLocation?._id,
      descriptor: faceIdData ? faceIdData : values?.descriptor?.length > 0 ? values?.descriptor : null
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: selectedInmate?.id || selectedInmate?._id, data: payload },
        {
          onSuccess: (res) => {
            if (res?.success === false) {
              enqueueSnackbar(res?.message || "Failed", { variant: "error" });
              return;
            }
            enqueueSnackbar("Student updated", { variant: "success" });
            handleClose();
          },
          onError: (err) => {
            enqueueSnackbar(err?.response?.data?.message || "Something went wrong", {
              variant: "error",
            });
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          if (res?.success === false) {
            enqueueSnackbar(res?.message || "Failed", { variant: "error" });
            return;
          }
          enqueueSnackbar("Student created", { variant: "success" });
          handleClose();
        },
        onError: (err) => {
          enqueueSnackbar(err?.response?.data?.message || "Something went wrong", {
            variant: "error",
          });
        },
      });
    }
  };

  const deleteFaceId = (faceId) => {
    deleteMutation.mutate(faceId, {
      onSuccess: (res) => {

        enqueueSnackbar(res?.message || "Face deleted successfully", {
          variant: "success",
        });
        queryClient.invalidateQueries({
          queryKey: ["userById", selectedInmate?.user_id],
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

  const balance = Number(selectedInmate?.balance ?? 0);

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{ timeout: 300 }}
    >
      <Fade in={open}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "90%",
            maxWidth: "800px",
            maxHeight: "90vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            boxShadow: 24,
            p: 3,
            borderRadius: 1,
          }}
        >
          <Typography variant="h6" mb={2} fontWeight={700}>
            {isEdit ? "Update Inmate" : "Create Inmate"}
          </Typography>

          {isEdit && (
            <Typography sx={{ mb: 1 }} fontWeight={600}>
              {selectedInmate?.firstName} {selectedInmate?.lastName} Balance:{" "}
              <span style={{ fontWeight: 700, color: balance > 0 ? "#16a34a" : "#dc2626" }}>
                ₹{balance}
              </span>
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <TextField
                fullWidth
                label={
                  <>
                    Inmate ID <span style={{ color: "red" }}>*</span>
                  </>
                }
                {...register("inmateId")}
                error={!!errors.inmateId}
                helperText={errors.inmateId?.message}
              />

              <TextField
                select
                fullWidth
                label={
                  <>
                    Status <span style={{ color: "red" }}>*</span>
                  </>
                }
                defaultValue={defaultValues.status}
                {...register("status")}
                error={!!errors.status}
                helperText={errors.status?.message}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="On Bail">On Bail</MenuItem>
                <MenuItem value="On Parole">On Parole</MenuItem>
                <MenuItem value="Released">Released</MenuItem>
                <MenuItem value="Transfer">Transfer</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label={
                  <>
                    First Name <span style={{ color: "red" }}>*</span>
                  </>
                }
                {...register("firstName")}
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
              />

              <TextField
                fullWidth
                label={
                  <>
                    Last Name <span style={{ color: "red" }}>*</span>
                  </>
                }
                {...register("lastName")}
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
              />

              <TextField
                fullWidth
                label={
                  <>
                    Mobile No <span style={{ color: "red" }}>*</span>
                  </>
                }
                {...register("phonenumber")}
                error={!!errors.phonenumber}
                helperText={errors.phonenumber?.message}
              />

              <TextField
                select
                fullWidth
                label={
                  <>
                    Custody Type <span style={{ color: "red" }}>*</span>
                  </>
                }
                defaultValue={defaultValues.custodyType}
                {...register("custodyType")}
                error={!!errors.custodyType}
                helperText={errors.custodyType?.message}
              >
                <MenuItem value="under_trail">Under Trail</MenuItem>
                <MenuItem value="contempt_of_court">Contempt of Court</MenuItem>
                <MenuItem value="remand_prison">Remand Prison</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label="Cell Number"
                {...register("cellNumber")}
                error={!!errors.cellNumber}
                helperText={errors.cellNumber?.message}
              />

              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register("dateOfBirth")}
                error={!!errors.dateOfBirth}
                helperText={errors.dateOfBirth?.message}
              />

              <TextField
                fullWidth
                label="Admission Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register("admissionDate")}
                error={!!errors.admissionDate}
                helperText={errors.admissionDate?.message}
              />

              {/* Face ID buttons */}
              <div className="grid grid-cols-[80%_20%] gap-2 pb-1 md:pb-0 items-center">
                <MuiButton
                  type="button"
                  onClick={() => setFaceidModalOpen(true)}
                  sx={{
                    backgroundColor: "#6b7280",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    height: 44,
                    "&:hover": { backgroundColor: "#4b5563" },
                  }}
                  fullWidth
                >
                  <Camera size={18} />
                  {selectedInmate?.user_id?.descriptor?.length > 0
                    ? "Update Face ID"
                    : "Register Face ID"}
                </MuiButton>

                <MuiButton
                  type="button"
                  disabled={!selectedInmate?.user_id?.descriptor?.length}
                 onClick={() => deleteFaceId(selectedInmate?.user_id?._id)}
                  sx={{
                    backgroundColor: "#ef4444",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 44,
                    "&:hover": { backgroundColor: "#dc2626" },
                  }}
                  fullWidth
                >
                  <Trash2 size={18} />
                </MuiButton>
              </div>

              {/* Block checkbox */}
              <div className="flex items-center gap-2">
                <input
                  id="is_blocked"
                  type="checkbox"
                  checked={Boolean(isBlocked)}
                  onChange={(e) => setValue("is_blocked", e.target.checked, { shouldValidate: true })}
                  className="h-4 w-4"
                />
                <label htmlFor="is_blocked" className="text-sm">
                  Block
                </label>
              </div>
            </div>

            <Box display="flex" justifyContent="end" gap={1} mt={2}>
              <MuiButton type="button" variant="outlined" color="error" onClick={handleClose}>
                Cancel
              </MuiButton>
              <MuiButton type="submit" variant="contained">
                {isEdit ? "Update" : "Create"}
              </MuiButton>
            </Box>
          </form>

          {faceidModalOpen && (
            <FaceRecognition
              mode="register"
              open={faceidModalOpen}
              setOpen={setFaceidModalOpen}
              faceIdData={faceIdData}
              setFaceIdData={setFaceIdData}
            />
          )}
        </Box>
      </Fade>
    </Modal>
  );
}
