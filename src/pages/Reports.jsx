import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    Card,
    CardContent,
    Typography,
    Button,
    MenuItem,
    Select,
    TextField,
    Autocomplete,
    CircularProgress,
} from "@mui/material";
import {
    BarChart3,
    TrendingUp,
    ChevronRight
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSnackbar } from "notistack";

import {
    useQuickStatisticsQuery,
    useGenerateReportMutation,
} from "../hooks/useReportsQuery";
import useDebounce from "../hooks/useDebounce";
import { useStudentExactQuery, useStudentsQuery } from "../hooks/useStudentExactQuery";
import { REPORT_TYPES } from "../constants/reportTypes";
import { parseReportQuery, describeQuery } from "../utils/nlReportQuery";
import NLReportCopilot from "../components/reports/NLReportCopilot";

/* =======================
   REPORT TYPES
   (moved to ../constants/reportTypes.js so the NL copilot's parser and the
   header's CopilotFab can share the same list - values are unchanged)
======================= */

const reportTypes = REPORT_TYPES;

export default function Reports() {
    const { enqueueSnackbar } = useSnackbar();
    const location = useLocation();

    const [apiUrl, setApiUrl] = useState(reportTypes[0]);
    const [format, setFormat] = useState("csv");
    const [dateRange, setDateRange] = useState("");
    const [frequency, setFrequency] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [student, setStudent] = useState(null);

    const { data: stats } = useQuickStatisticsQuery();
    const [studentSearch, setStudentSearch] = useState("");

    // ✅ debounce without library (simple)
    const debouncedSearch = useDebounce(studentSearch, 400);

    const { data: studentsRes, isFetching } = useStudentExactQuery(
        debouncedSearch,
    );

    // depends on your API shape:
    // either { data: [], total: number } OR direct array
    const students = studentsRes?.data ?? studentsRes ?? [];
    const total = studentsRes?.total ?? studentsRes?.count ?? 0;

    const reportMutation = useGenerateReportMutation();

    /* =======================
       NL REPORT & QUERY COPILOT
       Deterministic, rule-based (no AI/LLM - this codebase has none)
       translation of a free-text question into the same filter state the
       report cards below already use. See ../utils/nlReportQuery.js.
    ======================= */

    const [nlQuery, setNlQuery] = useState("");
    const [nlPreview, setNlPreview] = useState(null); // { sentence, note, isResolving, matchedAny }
    const [pendingInmateToken, setPendingInmateToken] = useState(null);
    const appliedNavQuery = useRef(false);

    const runCopilotParse = (text) => {
        if (!text || !text.trim()) return;
        const parsed = parseReportQuery(text, { fallbackReportTypeId: apiUrl.id });

        const reportChanged = parsed.reportTypeId && parsed.reportTypeId !== apiUrl.id;
        const nextApiUrl = reportChanged
            ? reportTypes.find((r) => r.id === parsed.reportTypeId) || apiUrl
            : apiUrl;

        // Mirror the same "switch report card" resets used by the manual
        // card-click handler below, then layer the parsed date info on top,
        // computed locally so the preview sentence never reads stale state.
        let effDateRange = reportChanged ? "" : dateRange;
        let effFrequency = reportChanged ? "" : frequency;
        let effStartDate = reportChanged ? "" : startDate;
        let effEndDate = reportChanged ? "" : endDate;

        if (parsed.dateMode === "frequency") {
            effFrequency = parsed.frequency;
            effDateRange = "";
            effStartDate = "";
            effEndDate = "";
        } else if (parsed.dateMode === "range") {
            effDateRange = parsed.dateRange;
            effFrequency = "";
            effStartDate = "";
            effEndDate = "";
        } else if (parsed.dateMode === "custom") {
            effDateRange = "custom";
            effFrequency = "";
            effStartDate = parsed.startDate;
            effEndDate = parsed.endDate;
        }

        const effFormat = parsed.format || format;

        if (reportChanged) {
            setApiUrl(nextApiUrl);
            setStudent(null);
        }
        setDateRange(effDateRange);
        setFrequency(effFrequency);
        setStartDate(effStartDate);
        setEndDate(effEndDate);
        if (parsed.format) setFormat(parsed.format);

        let isResolving = false;
        let note = null;
        if (nextApiUrl.id === 1 && parsed.inmateToken) {
            // Reuses the existing debounced inmate search (same one the
            // Autocomplete field uses) instead of adding a new lookup.
            setStudentSearch(parsed.inmateToken);
            setPendingInmateToken(parsed.inmateToken);
            isResolving = true;
            note = `Looking up inmate "${parsed.inmateToken}"...`;
        } else {
            setPendingInmateToken(null);
        }

        const effDateMode = effFrequency
            ? "frequency"
            : effDateRange === "custom"
            ? "custom"
            : effDateRange
            ? "range"
            : null;

        const sentence = describeQuery({
            reportTitle: nextApiUrl.title,
            dateMode: effDateMode,
            dateRange: effDateRange,
            frequency: effFrequency,
            startDate: effStartDate,
            endDate: effEndDate,
            format: effFormat,
            inmateLabel: nextApiUrl.id === 1 && parsed.inmateToken ? parsed.inmateToken : null,
        });

        setNlPreview({ sentence, note, isResolving, matchedAny: parsed.matchedAny });
    };

    // Prefill + auto-translate when arriving from the header's CopilotFab
    // (it hands off the raw question via router navigation state instead of
    // generating the report itself, so this page's generate() stays the
    // single place that produces PDF/CSV/Excel output).
    useEffect(() => {
        if (appliedNavQuery.current) return;
        const incoming = location.state?.nlQuery;
        if (incoming) {
            appliedNavQuery.current = true;
            setNlQuery(incoming);
            runCopilotParse(incoming);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // Resolve a parsed inmate token (e.g. "INM1023") against the same
    // student search results the Autocomplete field already fetches.
    useEffect(() => {
        if (!pendingInmateToken) return;
        if (debouncedSearch !== pendingInmateToken) return;
        if (isFetching) return;

        const match = students.find(
            (s) => (s?.inmateId || "").toLowerCase() === pendingInmateToken.toLowerCase()
        );

        if (match) {
            setStudent(match);
            setNlPreview((prev) =>
                prev
                    ? {
                        ...prev,
                        isResolving: false,
                        note: null,
                        sentence: describeQuery({
                            reportTitle: apiUrl.title,
                            dateMode: frequency ? "frequency" : dateRange === "custom" ? "custom" : dateRange ? "range" : null,
                            dateRange,
                            frequency,
                            startDate,
                            endDate,
                            format,
                            inmateLabel: `${match.firstName || ""} ${match.lastName || ""}`.trim() + ` (${match.inmateId})`,
                        }),
                    }
                    : prev
            );
        } else {
            setNlPreview((prev) =>
                prev
                    ? {
                        ...prev,
                        isResolving: false,
                        note: `No inmate found matching "${pendingInmateToken}" - the report will include all inmates in range.`,
                    }
                    : prev
            );
        }

        setPendingInmateToken(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingInmateToken, debouncedSearch, isFetching, students]);

    /* =======================
       PAYLOAD
    ======================= */

    const payload = useMemo(() => {
        if (apiUrl.id === 2) {
            return { dateRange: frequency, format };
        }

        if (dateRange === "custom") {
            return { startDate, endDate, format };
        }

        return { dateRange, format };
    }, [apiUrl, dateRange, startDate, endDate, format, frequency]);

    /* =======================
       PDF
    ======================= */

    const flatten = (obj, prefix = "") => {
        const out = {};
        for (const k in obj) {
            const val = obj[k];
            const key = prefix ? `${prefix}.${k}` : k;
            if (val && typeof val === "object" && !Array.isArray(val)) {
                Object.assign(out, flatten(val, key));
            } else {
                out[key] = Array.isArray(val) ? val.join(", ") : val ?? "";
            }
        }
        return out;
    };

    const createPDF = (rows, title) => {
        const flat = rows.map(flatten);
        const cols = [...new Set(flat.flatMap(Object.keys))];
        const body = flat.map((r) => cols.map((c) => r[c] ?? ""));

        const doc = new jsPDF("l", "pt", "a4");
        doc.text(title, 40, 40);

        autoTable(doc, {
            head: [cols],
            body,
            startY: 60,
            styles: { fontSize: 7 },
        });

        doc.save(`${title}.pdf`);
    };

    /* =======================
       SUBMIT
    ======================= */

    const generate = async () => {
        try {
            const res = await reportMutation.mutateAsync({
                url: apiUrl.apiUrl,
                payload:
                    apiUrl.id === 1
                        ? { ...payload, inmateId: student?.inmateId }
                        : payload,
                format,
            });

            if (format === "csv") {
                const blob = new Blob([res], { type: "text/csv" });
                download(blob, "report.csv");
            }

            if (format === "excel") {
                download(res, "report.xlsx");
            }

            if (format === "pdf") {
                const rows = apiUrl.id === 2 ? res.transactions : res.data;
                createPDF(rows, apiUrl.title.replace(" ", "_"));
            }

            enqueueSnackbar("Report generated successfully", { variant: "success" });
        } catch (e) {
            enqueueSnackbar("Report generation failed", { variant: "error" });
        }
    };

    const download = (blob, name) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleRunFromCopilot = async () => {
        await generate();
        setNlPreview(null);
    };

    /* =======================
       UI
    ======================= */

    return (
        <div className="p-4 md:p-2 md:p-6 bg-gray-50">
            <Typography variant="h5" className="mb-6 font-bold">
                Financial Reports
            </Typography>
            <h3>Generate and view comprehensive financial reports</h3>

            <NLReportCopilot
                value={nlQuery}
                onChange={setNlQuery}
                onAsk={() => runCopilotParse(nlQuery)}
                preview={nlPreview}
                onRun={handleRunFromCopilot}
                onDismiss={() => setNlPreview(null)}
                running={reportMutation.isPending}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">

                {/* Report Type */}
                <Card>
                    <CardContent className="space-y-5">
                        <h1 className="text-2xl font-bold">Report Types</h1>
                        {reportTypes.map((r) => (
                            <div
                                key={r.id}
                                onClick={() => {setApiUrl(r); setStudent(null); setDateRange(""); setFrequency(""); setStartDate(""); setEndDate(""); }}
                                className={`p-3 border rounded cursor-pointer flex justify-between ${apiUrl.id === r.id && "bg-primary text-white"
                                    }`}
                            >
                                <span>{r.title}</span>
                                <ChevronRight />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                    <CardContent className="space-y-4">
                        <h1 className="text-2xl font-bold">Report Parameters</h1>
                        {apiUrl.id === 2 && (
                            <TextField
                                select
                                fullWidth
                                size="large"
                                label="Frequency"
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value)}
                                sx={{marginBottom: "1rem"}}
                            >
                                <MenuItem value="">
                                    Select frequency
                                </MenuItem>

                                <MenuItem value="daily">Daily</MenuItem>
                                <MenuItem value="weekly">Weekly</MenuItem>
                                <MenuItem value="monthly">Monthly</MenuItem>
                                <MenuItem value="yearly">Yearly</MenuItem>
                            </TextField>
                        )}


                        {apiUrl.id !== 2 && (
                            <>
                                <TextField
                                    select
                                    fullWidth
                                    size="large"
                                    label="Date Range"
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    sx={{ marginBottom: "1rem" }}
                                >
                                    <MenuItem value="">
                                        Select date range
                                    </MenuItem>

                                    <MenuItem value="7daysago">Last 7 days</MenuItem>
                                    <MenuItem value="1monthago">Last 30 days</MenuItem>
                                    <MenuItem value="custom">Custom</MenuItem>
                                </TextField>

                                {dateRange === "custom" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <TextField type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        <TextField type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                    </div>
                                )}
                            </>
                        )}

                        {apiUrl.id === 1 && (
                            <Autocomplete
                                options={students}
                                value={student}
                                loading={isFetching}
                                filterOptions={(x) => x} // ✅ disable client filtering
                                onChange={(_, v) => setStudent(v)}
                                onInputChange={(_, value, reason) => {
                                    // reason guards avoid resetting when selecting option
                                    if (reason === "input") {
                                        setStudentSearch(value);
                                        setPage(1); // ✅ reset to first page on new search
                                    }
                                }}
                                getOptionLabel={(o) =>
                                    o ? `${o.firstName} ${o.lastName}` : ""
                                }
                                isOptionEqualToValue={(o, v) => o?._id === v?._id}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search Inmate ID"
                                        size="small"
                                        placeholder="Type inmate ID..."
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {isFetching ? <CircularProgress size={18} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        )}

                        <Select fullWidth value={format} onChange={(e) => setFormat(e.target.value)}>
                            <MenuItem value="pdf">PDF</MenuItem>
                            <MenuItem value="excel">Excel</MenuItem>
                            <MenuItem value="csv">CSV</MenuItem>
                        </Select>

                        <Button
                            variant="contained"
                            onClick={generate}
                            disabled={reportMutation.isPending}
                            className="bg-primary!"
                        >
                            {reportMutation.isPending ? "Generating..." : "Generate Report"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Stats */}
                <Card>
                    <CardContent className="space-y-4">
                        <h1 className="text-2xl font-bold">Quick Statistics</h1>
                        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 mb-1">Total System Balance</p>
                                <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.data?.totalSystemBalance}</p>
                            </div>
                            <div className={`p-2 rounded-lg bg-blue-50 shrink-0 ml-3`}>
                                <BarChart3 className={`h-5 w-5 md:h-6 md:w-6 text-blue-600`} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 mb-1">Monthly Deposits</p>
                                <p className="text-xl md:text-2xl font-bold text-gray-900">{stats?.data?.monthluyDeposits}</p>
                            </div>
                            <div className={`p-2 rounded-lg bg-blue-50 shrink-0 ml-3`}>
                                <TrendingUp className={`h-5 w-5 md:h-6 md:w-6 text-blue-600`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
