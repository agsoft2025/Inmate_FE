import { useEffect, useMemo, useState } from "react";
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

/* =======================
   REPORT TYPES
======================= */

const reportTypes = [
    { id: 1, title: "Inmate Balance Report", apiUrl: "reports/intimate-balance-report" },
    { id: 2, title: "Transaction Summary", apiUrl: "reports/transaction-summary-report" },
    { id: 3, title: "Canteen Sales", apiUrl: "reports/tuckshop-sales-report" },
    { id: 5, title: "Inventory", apiUrl: "reports/inventory-report" },
];

export default function Reports() {
    const { enqueueSnackbar } = useSnackbar();

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

    /* =======================
       UI
    ======================= */

    return (
        <div className="p-4 md:p-2 md:p-6 bg-gray-50">
            <Typography variant="h5" className="mb-6 font-bold">
                Financial Reports
            </Typography>
            <h3>Generate and view comprehensive financial reports</h3>

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
