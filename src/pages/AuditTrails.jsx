import { useEffect, useMemo, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import { Box, Button, Chip, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { ChevronRight, X } from "lucide-react";
import { useAuditLogsQuery } from "../hooks/useAuditLogsQuery";
import { useUsersQuery } from "../hooks/useUsersQuery";
import SmartSearch from "../components/common/SmartSearch";

const ACTION_META = {
    CREATE: { label: "Created", color: "success" },
    READ: { label: "Viewed", color: "info" },
    UPDATE: { label: "Updated", color: "warning" },
    DELETE: { label: "Deleted", color: "error" },
    LOGIN: { label: "Logged in", color: "primary" },
    LOGOUT: { label: "Logged out", color: "default" },
    GENERATE: { label: "Generated", color: "secondary" },
    BULK_UPSERT: { label: "Bulk updated", color: "warning" },
    UPDATE_STOCK: { label: "Updated stock", color: "warning" },
    CREATE_AND_PAY: { label: "Created and paid", color: "success" },
};

// Filters - dropdown options for the "Action type" filter, derived from
// ACTION_META so the filter list can never drift out of sync with the
// labels/colors already used to render the table and the digest.
const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label }));

// Audit Digest - actions considered worth flagging for a quick review,
// ranked by severity (higher = more important to look at first).
const FLAG_RULES = {
    DELETE: { severity: 3, reason: "Deletion - verify this was intended" },
    BULK_UPSERT: { severity: 2, reason: "Bulk update - review the scope of this change" },
    CREATE_AND_PAY: { severity: 2, reason: "Financial transaction created and paid in one step" },
    UPDATE_STOCK: { severity: 1, reason: "Inventory stock adjusted" },
};

const ENTITY_LABELS = {
    Intimate_Balance_Report: "Inmate Balance Report",
    TuckShop_Transaction_Report: "Tuckshop Transaction Report",
    POSShoppingCart: "POS Shopping Cart",
    Financial: "Financial Transaction",
    User: "User",
    Inmate: "Inmate",
    Department: "Department",
    TuckShop: "Tuckshop Item",
    AuditLog: "Audit Log",
};

const humanize = (value = "") =>
    String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase());

const humanizeEntity = (value = "") => ENTITY_LABELS[value] || humanize(value);

const formatValue = (value) => {
    if (value == null || value === "") return "-";
    if (Array.isArray(value)) return value.map(formatValue).join(", ");
    if (typeof value === "object") {
        const parts = Object.entries(value)
            .filter(([, v]) => v != null && v !== "")
            .slice(0, 3)
            .map(([key, v]) => `${humanize(key)}: ${formatValue(v)}`);
        return parts.length ? parts.join(" | ") : "-";
    }
    return humanize(value);
};

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};

const formatDateOnly = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
    }).format(date);
};

// Filters - converts a plain "yyyy-mm-dd" date-input value into the
// start/end-of-day ISO boundary the backend expects for fromDate/toDate.
// Parsed WITHOUT a trailing "Z" so the browser treats it as the user's own
// local calendar day rather than UTC midnight (avoids an off-by-one-day
// filter bug for users outside UTC).
const toRangeStart = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toRangeEnd = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const getActorName = (item) =>
    item?.userId?.fullName ||
    item?.userId?.username ||
    item?.username ||
    "-";

const getActionMeta = (action) => ACTION_META[action] || { label: humanize(action), color: "default" };

const getReference = (item) => {
    const inmateId = item?.changes?.inmateId;
    if (inmateId) return inmateId;
    if (item?.targetId) return String(item.targetId);
    return "-";
};

const getChangeSummary = (changes) => {
    if (!changes || typeof changes !== "object") return "-";

    const entries = Object.entries(changes)
        .filter(([key, value]) => !["_id", "__v"].includes(key) && value != null && value !== "")
        .slice(0, 4);

    if (!entries.length) return "-";

    return entries.map(([key, value]) => `${humanize(key)}: ${formatValue(value)}`).join(" | ");
};

// Audit Digest - builds a short deterministic narrative plus a shortlist of
// "flagged" items from today's logs. No AI/LLM involved: just counts and a
// severity table, since the backend always returns logs newest-first.
export const buildDigest = (logs) => {
    const list = Array.isArray(logs) ? logs : [];
    const total = list.length;

    if (total === 0) {
        return {
            narrative: "No audit activity has been recorded yet today.",
            flagged: [],
        };
    }

    const actorCounts = new Map();
    const notableActions = ["DELETE", "BULK_UPSERT", "CREATE_AND_PAY", "UPDATE_STOCK"];
    let notableCount = 0;

    list.forEach((item) => {
        const actor = getActorName(item);
        actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
        if (notableActions.includes(item?.action)) notableCount += 1;
    });

    const distinctActors = actorCounts.size;

    let mostActiveActor = null;
    let mostActiveCount = 0;
    actorCounts.forEach((count, actor) => {
        if (count > mostActiveCount) {
            mostActiveActor = actor;
            mostActiveCount = count;
        }
    });

    const sentences = [];
    sentences.push(
        `${total} ${total === 1 ? "action has" : "actions have"} been recorded today across ${distinctActors} ${
            distinctActors === 1 ? "user" : "users"
        }.`
    );

    if (mostActiveActor && mostActiveActor !== "-" && mostActiveCount > 1) {
        sentences.push(`${mostActiveActor} has been the most active, with ${mostActiveCount} actions.`);
    }

    if (notableCount > 0) {
        sentences.push(
            `${notableCount} ${
                notableCount === 1 ? "action needs" : "actions need"
            } a closer look (deletions, bulk updates, or stock/financial changes).`
        );
    } else {
        sentences.push("Nothing high-risk stood out today.");
    }

    const flagged = list
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => Boolean(FLAG_RULES[item?.action]))
        .sort((a, b) => {
            const severityDiff = FLAG_RULES[b.item.action].severity - FLAG_RULES[a.item.action].severity;
            if (severityDiff !== 0) return severityDiff;
            return a.index - b.index;
        })
        .slice(0, 5)
        .map(({ item, index }) => {
            const actionMeta = getActionMeta(item?.action);
            const rule = FLAG_RULES[item?.action];

            return {
                _id: item._id ?? `flag-${index}`,
                rankToday: index,
                reason: rule.reason,
                severity: rule.severity,
                actor: getActorName(item),
                actionLabel: actionMeta.label,
                actionColor: actionMeta.color,
                description: humanize(item?.description || "-"),
                reference: getReference(item),
                when: formatDateTime(item?.createdAt),
            };
        });

    return { narrative: sentences.join(" "), flagged };
};

export default function AuditTrails() {
    const { enqueueSnackbar } = useSnackbar();

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");

    // Filters - date range, user, and action type. All independent, all
    // optional, all combine with the existing search box (backend applies
    // them together as one query).
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [userId, setUserId] = useState("");
    const [actionType, setActionType] = useState("");

    // Bumped on "Clear filters" to force SmartSearch to remount with a
    // fresh internal text state - SmartSearch owns its own input text and
    // isn't a controlled component, so this is the simplest way to clear
    // its visible box without changing the shared component.
    const [filterResetKey, setFilterResetKey] = useState(0);

    // Audit Digest - highlight/scroll-to-row state for flagged-item navigation.
    const [highlightedLogId, setHighlightedLogId] = useState(null);
    const apiRef = useGridApiRef();
    const scrolledForIdRef = useRef(null);

    const apiPage = page + 1;

    const apiFromDate = useMemo(() => toRangeStart(fromDate), [fromDate]);
    const apiToDate = useMemo(() => toRangeEnd(toDate), [toDate]);
    const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

    const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery({
        page: apiPage,
        limit: pageSize,
        search,
        fromDate: apiFromDate,
        toDate: apiToDate,
        userId,
        action: actionType,
    });

    // Filters - user dropdown options. AuditTrails is an ADMIN/SUPER ADMIN
    // only route, the same roles allowed to call the users list endpoint,
    // so this reuses the existing users API without any new permission.
    const { data: usersData } = useUsersQuery({ page: 1, limit: 500, search: "" });
    const userOptions = useMemo(() => usersData?.data ?? [], [usersData]);

    // Audit Digest - a separate, independent query scoped to "today" so the
    // digest panel never interferes with the main table's own query/rows,
    // and is never affected by the filters above.
    const todayFromDate = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return start.toISOString();
    }, []);

    const {
        data: todaysData,
        isLoading: isDigestLoading,
        isError: isDigestError,
    } = useAuditLogsQuery({
        page: 1,
        limit: 200,
        search: "",
        fromDate: todayFromDate,
    });

    const digest = useMemo(() => buildDigest(todaysData?.data), [todaysData]);

    // Unified Smart Search - resets back to page 1 whenever the search
    // term changes, same as a page-size change already does below.
    const handleSearch = (value) => {
        setSearch(value);
        setPage(0);
        setHighlightedLogId(null);
    };

    // Filters - each filter resets pagination and clears any active
    // flagged-item highlight, same as a manual search or page change does.
    const handleFromDateChange = (value) => {
        setFromDate(value);
        setPage(0);
        setHighlightedLogId(null);
    };

    const handleToDateChange = (value) => {
        setToDate(value);
        setPage(0);
        setHighlightedLogId(null);
    };

    const handleUserFilterChange = (value) => {
        setUserId(value);
        setPage(0);
        setHighlightedLogId(null);
    };

    const handleActionFilterChange = (value) => {
        setActionType(value);
        setPage(0);
        setHighlightedLogId(null);
    };

    const hasActiveFilters = Boolean(search || fromDate || toDate || userId || actionType);

    const handleClearFilters = () => {
        setSearch("");
        setFromDate("");
        setToDate("");
        setUserId("");
        setActionType("");
        setPage(0);
        setHighlightedLogId(null);
        setFilterResetKey((key) => key + 1);
    };

    const rows = useMemo(() => {
        const list = data?.data ?? [];
        return list.map((item, idx) => {
            const actionMeta = getActionMeta(item?.action);

            return {
                id: item._id ?? `${apiPage}-${idx}`,
                actor: getActorName(item),
                action: item?.action || "-",
                actionLabel: actionMeta.label,
                actionColor: actionMeta.color,
                targetModel: humanizeEntity(item?.targetModel || "-"),
                description: humanize(item?.description || "-"),
                details: getChangeSummary(item?.changes),
                reference: getReference(item),
                when: formatDateTime(item?.createdAt),
            };
        });
    }, [data, apiPage]);

    const columns = useMemo(
        () => [
            {
                field: "when",
                headerName: "When",
                flex: 1,
                minWidth: 160,
            },
            {
                field: "actor",
                headerName: "User",
                flex: 1,
                minWidth: 150,
            },
            {
                field: "action",
                headerName: "Action",
                flex: 1,
                minWidth: 150,
                renderCell: (params) => {
                    const { actionLabel, actionColor } = params.row;
                    return <Chip size="small" label={actionLabel} color={actionColor} variant="outlined" />;
                },
                sortable: false,
            },
            {
                field: "targetModel",
                headerName: "Module",
                flex: 1.2,
                minWidth: 180,
            },
            {
                field: "description",
                headerName: "What happened",
                flex: 2,
                minWidth: 260,
                renderCell: (params) => (
                    <Tooltip title={params.value || "-"} arrow>
                        <Typography variant="body2" noWrap>
                            {params.value}
                        </Typography>
                    </Tooltip>
                ),
            },
            {
                field: "details",
                headerName: "Details",
                flex: 2,
                minWidth: 280,
                renderCell: (params) => (
                    <Tooltip title={params.value || "-"} arrow>
                        <Typography variant="body2" noWrap>
                            {params.value}
                        </Typography>
                    </Tooltip>
                ),
            },
            {
                field: "reference",
                headerName: "Reference",
                flex: 1,
                minWidth: 140,
            },
        ],
        []
    );

    useEffect(() => {
        if (isError) {
            enqueueSnackbar(error?.response?.data?.message || "Failed to load audit logs", {
                variant: "error",
            });
        }
    }, [isError, error, enqueueSnackbar]);

    // Audit Digest - once the highlighted row's page has loaded, scroll it
    // into view. Uses a ref (not a one-shot boolean) so repeated clicks on
    // different flagged items each get their own scroll.
    useEffect(() => {
        if (!highlightedLogId || isLoading || isFetching || !rows.length) return;
        if (scrolledForIdRef.current === highlightedLogId) return;

        const rowIndex = rows.findIndex((row) => row.id === highlightedLogId);
        if (rowIndex === -1) return;

        scrolledForIdRef.current = highlightedLogId;
        requestAnimationFrame(() => {
            try {
                apiRef.current?.scrollToIndexes?.({ rowIndex, colIndex: 0 });
            } catch {
                // Grid may not be ready yet - highlighting still applies via getRowClassName.
            }
        });
    }, [highlightedLogId, rows, isLoading, isFetching, apiRef]);

    // Audit Digest - jump to the flagged item's page and highlight its row.
    // Because the backend always sorts logs newest-first, a flagged item's
    // index within today's logs is also its rank in the full unfiltered
    // table, so we can compute the target page without a dedicated API.
    // Also clears the other filters so the item is guaranteed to be visible.
    const handleFlaggedItemClick = (item) => {
        if (hasActiveFilters) {
            setSearch("");
            setFromDate("");
            setToDate("");
            setUserId("");
            setActionType("");
            setFilterResetKey((key) => key + 1);
        }
        setPage(Math.floor(item.rankToday / pageSize));
        scrolledForIdRef.current = null;
        setHighlightedLogId(item._id);
    };

    const total = data?.pagination?.total ?? 0;

    return (
        <div className="w-full bg-gray-50 p-1 md:p-5">
            <div className="max-w-8xl mx-auto space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-2xl font-bold text-gray-900 pl-2">Audit Trails</h1>
                    <p className="text-gray-600 text-sm md:text-base pl-2">
                        Human readable activity history with clear who, what, and when details
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <Typography variant="h6" className="!font-semibold !text-gray-900">
                            Daily Digest
                        </Typography>
                        <Chip size="small" label={formatDateOnly(new Date())} variant="outlined" />
                    </div>

                    {isDigestLoading ? (
                        <Typography variant="body2" color="text.secondary">
                            Building today&apos;s digest...
                        </Typography>
                    ) : isDigestError ? (
                        <Typography variant="body2" color="text.secondary">
                            Digest is unavailable right now.
                        </Typography>
                    ) : (
                        <>
                            <Typography variant="body2" className="text-gray-700 mb-3">
                                {digest.narrative}
                            </Typography>

                            {digest.flagged.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    Nothing flagged for review today.
                                </Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {digest.flagged.map((item) => (
                                        <button
                                            key={item._id}
                                            type="button"
                                            onClick={() => handleFlaggedItemClick(item)}
                                            className={`w-full text-left flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-amber-50 hover:border-amber-300 ${
                                                highlightedLogId === item._id
                                                    ? "bg-amber-50 border-amber-300"
                                                    : "border-gray-200"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <Chip
                                                    size="small"
                                                    label={item.actionLabel}
                                                    color={item.actionColor}
                                                    variant="outlined"
                                                />
                                                <div className="min-w-0">
                                                    <Typography variant="body2" className="text-gray-900 font-medium">
                                                        {item.reason}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        className="block truncate"
                                                    >
                                                        {item.actor} • {item.when}
                                                        {item.reference !== "-" ? ` • Ref: ${item.reference}` : ""}
                                                    </Typography>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-400 shrink-0" />
                                        </button>
                                    ))}
                                </Stack>
                            )}
                        </>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow p-4">
                    <div className="mb-3 max-w-md">
                        <SmartSearch
                            key={filterResetKey}
                            placeholder="Search by user, action, module, or description"
                            onSearch={handleSearch}
                            loading={isFetching && !isLoading}
                            fullWidth
                        />
                    </div>

                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <TextField
                            type="date"
                            size="small"
                            label="From date"
                            value={fromDate}
                            onChange={(e) => handleFromDateChange(e.target.value)}
                            error={dateRangeInvalid}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ max: toDate || undefined }}
                        />
                        <TextField
                            type="date"
                            size="small"
                            label="To date"
                            value={toDate}
                            onChange={(e) => handleToDateChange(e.target.value)}
                            error={dateRangeInvalid}
                            helperText={dateRangeInvalid ? "End date must be on/after the start date" : " "}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ min: fromDate || undefined }}
                        />
                        <TextField
                            select
                            size="small"
                            label="User"
                            value={userId}
                            onChange={(e) => handleUserFilterChange(e.target.value)}
                        >
                            <MenuItem value="">All users</MenuItem>
                            {userOptions.map((user) => (
                                <MenuItem key={user._id} value={user._id}>
                                    {user.fullname || user.username}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            size="small"
                            label="Action type"
                            value={actionType}
                            onChange={(e) => handleActionFilterChange(e.target.value)}
                        >
                            <MenuItem value="">All actions</MenuItem>
                            {ACTION_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <div className="flex items-start">
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={handleClearFilters}
                                disabled={!hasActiveFilters}
                                startIcon={<X size={14} />}
                            >
                                Clear filters
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-3">
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={`Total logs: ${total}`} variant="outlined" />
                            <Chip size="small" label="Readable view" color="primary" variant="outlined" />
                            {hasActiveFilters && (
                                <Chip size="small" label="Filters active" color="secondary" variant="outlined" />
                            )}
                        </Stack>
                        <div className="text-xs text-slate-500">
                            {isFetching && !isLoading ? "Updating..." : ""}
                        </div>
                    </div>

                    <Box sx={{ height: "calc(100vh - 300px)", width: "100%" }}>
                        <DataGrid
                            apiRef={apiRef}
                            rows={rows}
                            columns={columns}
                            loading={isLoading || isFetching}
                            pagination
                            paginationMode="server"
                            rowCount={total}
                            pageSizeOptions={[10, 20, 50]}
                            paginationModel={{ page, pageSize }}
                            onPaginationModelChange={(model) => {
                                const pageChanged = model.page !== page;
                                const sizeChanged = model.pageSize !== pageSize;

                                setHighlightedLogId(null);

                                if (sizeChanged) {
                                    setPage(0);
                                    setPageSize(model.pageSize);
                                    return;
                                }

                                if (pageChanged) {
                                    setPage(model.page);
                                }
                            }}
                            disableRowSelectionOnClick
                            getRowId={(row) => row.id}
                            getRowClassName={(params) =>
                                highlightedLogId && params.row.id === highlightedLogId ? "highlighted-audit-row" : ""
                            }
                            sx={{
                                border: "none",
                                "& .MuiDataGrid-columnHeaders": {
                                    backgroundColor: "#f8fafc",
                                    borderBottom: "1px solid #e2e8f0",
                                },
                                "& .MuiDataGrid-cell": {
                                    alignItems: "center",
                                },
                                "& .highlighted-audit-row": {
                                    backgroundColor: "#fef3c7",
                                },
                                "& .highlighted-audit-row:hover": {
                                    backgroundColor: "#fde68a",
                                },
                            }}
                        />
                    </Box>
                </div>
            </div>
        </div>
    );
}
