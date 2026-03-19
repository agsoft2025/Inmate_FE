import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Divider,
} from "@mui/material";

import { useStudentExactQuery } from "../hooks/useStudentExactQuery";
import { useCreateDepositMutation } from "../hooks/useCreateDepositMutation";
import useDebounce from "../hooks/useDebounce";
import { InmatePanel } from "../components/finanicalManagement/StudentPanel";
import { EmptyStudentPanel } from "../components/finanicalManagement/EmptyStudentPanel";

const schema = yup.object({
  query: yup.string().required("Inmate ID is required"), // STU001
  depositType: yup.string().required("Deposit Type is required"),
  relationShipId: yup.string().required("Relationship is required"),
  depositAmount: yup
    .number()
    .typeError("Deposit amount must be a number")
    .positive("Amount must be positive")
    .required("Deposit amount is required"),
  remarks: yup.string().required("Remarks are required"),
  fileIds: yup
    .array()
    .of(yup.string().required())
    .min(1, "Please upload at least 1 file")
    .required("Please upload at least 1 file"),
});

export default function FinancialManagement() {
  const { enqueueSnackbar } = useSnackbar();

  const [searchValue, setSearchValue] = useState(""); // STU001 typed

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
    control
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      query: "",
      depositType: "",
      relationShipId: "",
      depositAmount: "",
      remarks: "",
      fileIds: [],
    },
  });

  // watch the exactData field (student search)
  const exactData = watch("query");

  const debouncedStudentId = useDebounce(exactData, 600);
  // student search query
  const studentQuery = useStudentExactQuery(debouncedStudentId);
  const student = studentQuery.data?.data?.[0] || null;

  const mutation = useCreateDepositMutation();
  const [loading, setLoading] = useState(false);

  const fileIds = watch("fileIds");


  // show warning when no student
  const showStudentPanel = useMemo(() => !!student, [student]);

  const onSubmit = (values) => {
    if (!student?._id) {
      enqueueSnackbar("Please enter a valid Student ID (e.g. STU001)", {
        variant: "warning",
      });
      return;
    }

    const payload = {
      inmateId: student.inmateId,
      depositType: values.depositType,
      depositAmount: Number(values.depositAmount),
      relationShipId: values.relationShipId,
      remarks: values.remarks,
      status: "completed",
      type: "deposit",
      fileIds: values.fileIds
    };

    mutation.mutate(payload, {
      onSuccess: (res) => {
        if (res?.success) {
          enqueueSnackbar("Deposit processed successfully", { variant: "success" });
          reset({
            query: "",
            depositType: "",
            relationShipId: "",
            depositAmount: "",
            remarks: "",
          }); // clears form
          setSearchValue("");
        } else {
          enqueueSnackbar(res?.message || "Deposit failed", { variant: "error" });
        }
      },
      onError: (err) => {
        enqueueSnackbar(err?.response?.data?.message || "Deposit failed", {
          variant: "error",
        });
      },
    });
  };

  async function uploadFiles(files) {
    setLoading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}file`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result?.status) {
        return result.data.map((f) => f._id);
      }

      return [];
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-white shadow-sm">
      {/* Header */}
      <Box className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between p-4">
        <Box className="min-w-0">
          <Typography variant="h6" fontWeight={700} className="truncate">
            Deposit Processing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Process wages, deposits, and balance adjustments
          </Typography>
        </Box>

        {showStudentPanel && (
          <Box className="sm:text-right">
            <Typography
              variant="body2"
              fontWeight={600}
              color="success.main"
              className="break-words"
            >
              Inmate: {student.firstName} {student.lastName}
            </Typography>

            <Typography variant="body2" fontWeight={700} color="success.main">
              Balance: ₹{student.balance ?? 0}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      <CardContent>
        {/* ✅ Responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left side form */}
          <div className="flex flex-col gap-3">
            {/* Student Search */}
            <Box>
              <Typography variant="subtitle2" className="mb-1">
                Inmate ID
              </Typography>

              <TextField
                fullWidth
                size="small"
                placeholder="Enter exact inmate id (ex: INM001)"
                value={searchValue}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setSearchValue(val);
                  setValue("query", val, { shouldValidate: true });
                }}
                error={!!errors.query}
                helperText={errors.query?.message}
              />

              <div className="mt-1 text-xs text-gray-500">
                {studentQuery.isFetching ? "Searching..." : ""}
                {!studentQuery.isFetching && exactData?.length >= 3 && !student && (
                  <span className="text-red-500">No student found</span>
                )}
              </div>
            </Box>

            {/* Deposit Type */}
            <Controller
              name="depositType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Deposit Type"
                  size="small"
                  fullWidth
                  select
                  error={!!errors.depositType}
                  helperText={errors.depositType?.message}
                >
                  <MenuItem value="">Select</MenuItem>
                  <MenuItem value="Bank">Bank</MenuItem>
                </TextField>
              )}
            />

            {/* Relationship */}
            <Controller
              name="relationShipId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Relationship"
                  size="small"
                  fullWidth
                  select
                  error={!!errors.relationShipId}
                  helperText={errors.relationShipId?.message}
                >
                  <MenuItem value="">Select</MenuItem>
                  <MenuItem value="mother">Mother</MenuItem>
                  <MenuItem value="father">Father</MenuItem>
                  <MenuItem value="sibling">Sibling</MenuItem>
                  <MenuItem value="teacher">Teacher</MenuItem>
                  <MenuItem value="friend">Friend</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              )}
            />

            {/* Deposit Amount */}
            <TextField
              label="Deposit Amount"
              size="small"
              fullWidth
              type="number"
              {...register("depositAmount")}
              error={!!errors.depositAmount}
              helperText={errors.depositAmount?.message}
              onWheel={(e) => e.target.blur()}
            />

            {/* Remarks */}
            <TextField
              label="Remarks"
              size="small"
              fullWidth
              {...register("remarks")}
              error={!!errors.remarks}
              helperText={errors.remarks?.message}
            />

            <Box>
              <Typography variant="subtitle2" className="mb-1">
                Upload Files <span className="text-red-500">*</span>
              </Typography>

              <TextField
                fullWidth
                size="small"
                type="file"
                inputProps={{ multiple: true }}
                error={!!errors.fileIds}
                helperText={errors.fileIds?.message}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;

                  const ids = await uploadFiles(files);

                  // ✅ append newly uploaded ids to existing ids
                  const current = watch("fileIds") || [];
                  setValue("fileIds", [...current, ...ids], { shouldValidate: true });

                  // ✅ allow re-selecting the same file later
                  e.target.value = "";
                }}
              />

              {loading && (
                <Typography variant="caption" color="primary" className="mt-1 block">
                  Uploading...
                </Typography>
              )}

              {!!fileIds?.length && (
                <Typography variant="caption" color="success.main" className="mt-1 block">
                  {fileIds.length} file(s) uploaded
                </Typography>
              )}

              {!!fileIds?.length && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setValue("fileIds", [], { shouldValidate: true })}
                  sx={{ mt: 1 }}
                >
                  Clear uploads
                </Button>
              )}
            </Box>


            <Button
              variant="contained"
              fullWidth
              onClick={handleSubmit(onSubmit)}
              disabled={mutation.isPending}
              sx={{
                backgroundColor: "#16a34a",
                "&:hover": { backgroundColor: "#15803d" },
                py: 1.2,
                fontWeight: 700,
              }}
            >
              {mutation.isPending ? "Processing..." : "Process Deposit"}
            </Button>
          </div>

          {/* Right side panel */}
          <div className="min-w-0">
            {showStudentPanel ? <InmatePanel inmate={student} /> : <EmptyStudentPanel />}
          </div>
        </div>
      </CardContent>
    </Card>

  );
}
