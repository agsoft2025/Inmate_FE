import { useEffect, useMemo, useRef, useState } from "react";
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
  Autocomplete,
  Button,
  MenuItem,
  Divider,
  CircularProgress,
  Chip,
} from "@mui/material";
import { ScanLine } from "lucide-react";

import { useStudentExactQuery } from "../hooks/useStudentExactQuery";
import { useCreateDepositMutation } from "../hooks/useCreateDepositMutation";
import useDebounce from "../hooks/useDebounce";
import { InmatePanel } from "../components/finanicalManagement/StudentPanel";
import { EmptyStudentPanel } from "../components/finanicalManagement/EmptyStudentPanel";
import { runOcr, parseDepositSlipFields, getConfidenceTier } from "../utils/documentScanUtils";

// Labels shown in the "filled N fields from the deposit slip" confirmation -
// keys match parseDepositSlipFields()'s return shape.
const DEPOSIT_FIELD_LABELS = {
  query: "Inmate ID",
  depositType: "Deposit Type",
  relationShipId: "Relationship",
  depositAmount: "Deposit Amount",
  remarks: "Remarks",
};

// Fields highlight with this red border + tinted background when their
// scanned confidence is under the "low" tier and the user hasn't edited
// the value since the scan.
const LOW_CONFIDENCE_SX = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#fef2f2",
    "& fieldset": { borderColor: "#ef4444" },
  },
};

const schema = yup.object({
  query: yup.string().required("Inmate ID is required"), // STU001
  depositType: yup
    .string()
    .oneOf(["Bank","Cash"], "Only bank or cash deposits are accepted")
    .required("Deposit Type is required"),
  relationShipId: yup.string().required("Relationship is required"),
  depositAmount: yup
    .number()
    .typeError("Deposit amount must be a number")
    .positive("Amount must be positive")
    .required("Deposit amount is required"),
  remarks: yup.string().required("Remarks are required"),
  fileIds: yup.array().of(yup.string()).default([]),
});

export default function FinancialManagement() {
  const { enqueueSnackbar } = useSnackbar();

  // Unified inmate lookup - mirrors the Autocomplete pattern used in
  // Reports.jsx's "Search Inmate ID" field:
  //  - `inputText` is what's actually shown in the box.
  //  - `studentSearch` is the text that drives the debounced backend
  //    search (only updated while the user is actively typing, not when
  //    selecting a suggestion or blurring - same as Reports.jsx).
  //  - `student` is the selected inmate record, set ONLY via onChange
  //    (an explicit pick from the suggestions, never auto-picked from the
  //    first search result the way the old exact-ID lookup worked).
  const [inputText, setInputText] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [student, setStudent] = useState(null);

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
      depositType: "Bank",
      relationShipId: "",
      depositAmount: "",
      remarks: "",
      fileIds: [],
    },
  });

  // Same debounce + search hook Reports.jsx uses for its inmate
  // Autocomplete - searchStudentExact() hits GET inmate/search, which
  // matches inmateId/firstName/lastName/cellNumber and returns an array of
  // candidates (despite the "Exact" name, it's a fuzzy/partial search).
  // Reused as-is: no new API, no new hook.
  const debouncedSearch = useDebounce(studentSearch, 400);
  const studentQuery = useStudentExactQuery(debouncedSearch);
  const students = studentQuery.data?.data ?? studentQuery.data ?? [];

  const mutation = useCreateDepositMutation();
  const [loading, setLoading] = useState(false);

  // Scan Deposit Slip: OCR + field extraction (separate from the file
  // upload/attachment flow below - scanning only reads text to pre-fill
  // fields, it doesn't attach the photo as evidence).
  const [isExtracting, setIsExtracting] = useState(false);
  const depositSlipInputRef = useRef(null);
  const [scannedFileName, setScannedFileName] = useState(null);
  // Per-field OCR confidence + the value that was in the field right after
  // the scan, keyed by form field name. A badge only describes the field
  // it's attached to, and clears itself once the user edits that field's
  // value away from what the scan produced.
  const [fieldConfidence, setFieldConfidence] = useState({});

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
            depositType: "Bank",
            relationShipId: "",
            depositAmount: "",
            remarks: "",
          }); // clears form
          setInputText("");
          setStudentSearch("");
          setStudent(null);
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

  // Runs OCR on the selected photo/scan and pre-fills whatever deposit-slip
  // fields it can confidently read, along with a per-field confidence score
  // (from Tesseract.js's own word-level confidence where available). Only
  // ever calls setValue() (and mirrors the Inmate ID into the search box
  // the same way manual typing does) - never submits the form, and never
  // auto-selects an inmate on the user's behalf: a scanned ID just
  // pre-fills the search box and lets its match(es) show up in the
  // Autocomplete's suggestions, same as if the user had typed it - the
  // user still reviews and picks the correct inmate themselves before
  // submitting. This matters more than it might seem: OCR reads are
  // exactly the kind of noisy data (a misread character, a similar ID)
  // where silently trusting a "best guess" match on a financial deposit
  // would be risky.
  async function handleDepositSlipFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;

    setScannedFileName(file.name);
    setIsExtracting(true);
    try {
      const { text, confidence: pageConfidence, words } = await runOcr(file);
      const extracted = parseDepositSlipFields(text, words, pageConfidence);
      const foundFields = Object.keys(extracted);

      foundFields.forEach((key) => {
        if (key === "query") {
          setInputText(extracted.query.value);
          setStudentSearch(extracted.query.value);
        }
        setValue(key, extracted[key].value, { shouldValidate: true, shouldDirty: true });
      });

      setFieldConfidence((prev) => {
        const next = { ...prev };
        foundFields.forEach((key) => {
          next[key] = { confidence: extracted[key].confidence, scannedValue: extracted[key].value };
        });
        return next;
      });

      if (foundFields.length > 0) {
        enqueueSnackbar(
          `Filled ${foundFields.length} field${foundFields.length === 1 ? "" : "s"} from the deposit slip (${foundFields
            .map((key) => DEPOSIT_FIELD_LABELS[key])
            .join(", ")}). Please review before submitting - low-confidence fields are highlighted.`,
          { variant: "info" }
        );
      } else {
        enqueueSnackbar(
          "Couldn't confidently read any fields from that image - please fill them in manually.",
          { variant: "warning" }
        );
      }
    } catch (err) {
      enqueueSnackbar(
        "Couldn't scan that image. Please try again or fill in the fields manually.",
        { variant: "error" }
      );
    } finally {
      setIsExtracting(false);
    }
  }

  // Reads back the confidence for a field, but only while the current form
  // value still matches what the scan produced - returns undefined (show no
  // badge) once the user edits the field away from what OCR read. A
  // defined-but-null return means "show a badge, confidence just wasn't
  // available" (handled by getConfidenceTier's "unknown" tier).
  const getActiveFieldConfidence = (fieldKey) => {
    const info = fieldConfidence[fieldKey];
    if (!info) return undefined;
    const liveValue = watch(fieldKey);
    if (String(liveValue ?? "") !== String(info.scannedValue ?? "")) return undefined;
    return info.confidence;
  };

  const isLowConfidenceField = (fieldKey) => {
    const confidence = getActiveFieldConfidence(fieldKey);
    if (confidence === undefined) return false;
    return getConfidenceTier(confidence).level === "low";
  };

  const renderConfidenceBadge = (fieldKey) => {
    const confidence = getActiveFieldConfidence(fieldKey);
    if (confidence === undefined) return null;

    const tier = getConfidenceTier(confidence);
    return (
      <div className="flex items-center gap-2 -mt-1">
        <Chip
          size="small"
          label={`OCR: ${tier.label}`}
          color={tier.color}
          variant={tier.level === "high" ? "outlined" : "filled"}
        />
        {tier.level === "low" && (
          <span className="text-xs text-red-600">Please verify this field</span>
        )}
      </div>
    );
  };

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
            {/* Scan Deposit Slip - OCR pre-fill, review before submit */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">Scan Deposit Slip</p>
                <p className="text-xs text-slate-500">
                  Photograph or upload the deposit slip to pre-fill the fields below. Everything stays editable - nothing is submitted automatically.
                </p>
              </div>

              <Button
                variant="outlined"
                size="small"
                disabled={isExtracting}
                startIcon={isExtracting ? <CircularProgress size={16} /> : <ScanLine size={16} />}
                onClick={() => depositSlipInputRef.current?.click()}
                sx={{ whiteSpace: "nowrap" }}
              >
                {isExtracting ? "Extracting..." : "Scan Deposit Slip"}
              </Button>

              <input
                ref={depositSlipInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleDepositSlipFileSelected}
              />
            </div>

            {scannedFileName && (
              <p className="-mt-1 text-xs text-slate-500">
                Scanned document: <span className="font-medium text-slate-700">{scannedFileName}</span>
              </p>
            )}

            {/* Inmate lookup - searchable Autocomplete (same pattern as
                Reports.jsx's "Search Inmate ID" field) instead of an
                exact-ID-only text box. Type an ID or name, pick the right
                inmate from the suggestions. */}
            <Box>
              <Typography variant="subtitle2" className="mb-1">
                Inmate
              </Typography>

              <Autocomplete
                fullWidth
                options={students}
                value={student}
                loading={studentQuery.isFetching}
                filterOptions={(x) => x} // ✅ results already come pre-filtered from the backend search
                onChange={(_, value) => {
                  setStudent(value);
                  setValue("query", value?.inmateId || "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                inputValue={inputText}
                onInputChange={(_, value, reason) => {
                  setInputText(value);
                  // Only feed the search debounce while the user is
                  // actually typing - not on selection/blur "reset", and
                  // not on "clear" (handled separately below), same as
                  // Reports.jsx's onInputChange guard.
                  if (reason === "input") setStudentSearch(value);
                  if (reason === "clear") setStudentSearch("");
                }}
                getOptionLabel={(o) => (o ? `${o.inmateId} - ${o.firstName} ${o.lastName}` : "")}
                isOptionEqualToValue={(o, v) => o?._id === v?._id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Search by inmate ID or name..."
                    error={!!errors.query}
                    helperText={errors.query?.message}
                    sx={isLowConfidenceField("query") ? LOW_CONFIDENCE_SX : undefined}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {studentQuery.isFetching ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <div className="mt-1 text-xs text-gray-500">
                {studentQuery.isFetching ? "Searching..." : ""}
                {!studentQuery.isFetching &&
                  !student &&
                  studentSearch.length >= 3 &&
                  students.length === 0 && (
                    <span className="text-red-500">No inmate found</span>
                  )}
              </div>
              {renderConfidenceBadge("query")}
            </Box>

            {/* Deposit Type */}
            <div>
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
                    sx={isLowConfidenceField("depositType") ? LOW_CONFIDENCE_SX : undefined}
                  >
                    <MenuItem value="Bank">Bank</MenuItem>
                    <MenuItem value="Cash">Cash</MenuItem>
                  </TextField>
                )}
              />
              {renderConfidenceBadge("depositType")}
            </div>

            {/* Relationship */}
            <div>
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
                    sx={isLowConfidenceField("relationShipId") ? LOW_CONFIDENCE_SX : undefined}
                  >
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="mother">Mother</MenuItem>
                    <MenuItem value="father">Father</MenuItem>
                    <MenuItem value="sibling">Sibling</MenuItem>
                    <MenuItem value="teacher">Advocate</MenuItem>
                    <MenuItem value="friend">Friend</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>
                )}
              />
              {renderConfidenceBadge("relationShipId")}
            </div>

            {/* Deposit Amount */}
            <div>
              <TextField
                label="Deposit Amount"
                size="small"
                fullWidth
                type="number"
                {...register("depositAmount")}
                error={!!errors.depositAmount}
                helperText={errors.depositAmount?.message}
                onWheel={(e) => e.target.blur()}
                sx={isLowConfidenceField("depositAmount") ? LOW_CONFIDENCE_SX : undefined}
              />
              {renderConfidenceBadge("depositAmount")}
            </div>

            {/* Remarks */}
            <div>
              <TextField
                label="Remarks"
                size="small"
                fullWidth
                {...register("remarks")}
                error={!!errors.remarks}
                helperText={errors.remarks?.message}
                sx={isLowConfidenceField("remarks") ? LOW_CONFIDENCE_SX : undefined}
              />
              {renderConfidenceBadge("remarks")}
            </div>

            <Box>
              <Typography variant="subtitle2" className="mb-1">
                Upload Files (optional)
              </Typography>

              <TextField
                fullWidth
                size="small"
                type="file"
                inputProps={{ multiple: true }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;

                  const ids = await uploadFiles(files);

                  // append newly uploaded ids to existing ids
                  const current = watch("fileIds") || [];
                  setValue("fileIds", [...current, ...ids], { shouldValidate: true });

                  // allow re-selecting the same file later
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
