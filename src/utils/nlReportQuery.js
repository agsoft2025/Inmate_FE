// NL Report & Query Copilot - deterministic, rule-based natural-language
// parser for Reports.jsx's "Ask for a report..." input and the floating
// CopilotFab widget in the admin header.
//
// IMPORTANT: this project has no AI/LLM API anywhere in the codebase, so
// "translating" a question into a report query is done here with plain
// keyword/regex matching against the filters Reports.jsx already supports
// (see REPORT_TYPES, the dateRange enum used by intmateBalanceReport /
// tuckShopSalesReport / inventoryStockHistoryReport, the frequency enum
// used by transactionSummaryReport, and the pdf/excel/csv format enum).
// It is intentionally simple and will not understand arbitrary phrasing -
// that is a known limitation of a deterministic approach, not a bug.
//
// Every exported function here is pure (no DOM, no network, no React) so
// it can be unit tested standalone and reused by both Reports.jsx (full
// inline copilot) and CopilotFab.jsx (header quick-question widget).

const REPORT_TYPE_PHRASES = [
    {
        id: 1,
        keywords: [
            "inmate balance",
            "prisoner balance",
            "wallet balance",
            "balance report",
            "balance",
            "wallet",
            "funds",
        ],
    },
    {
        id: 2,
        keywords: [
            "transaction summary",
            "transaction history",
            "transactions",
            "transaction",
            "activity report",
            "activity",
        ],
    },
    {
        id: 3,
        keywords: [
            "canteen sales",
            "commissary sales",
            "shop sales",
            "pos sales",
            "sales report",
            "canteen",
            "commissary",
            "purchases",
            "purchase",
            "sales",
        ],
    },
    {
        id: 5,
        keywords: [
            "inventory report",
            "stock report",
            "inventory",
            "stock",
            "supplies",
            "supply",
        ],
    },
];

const FREQUENCY_PHRASES = [
    { value: "daily", keywords: ["today", "daily"] },
    { value: "weekly", keywords: ["this week", "weekly"] },
    { value: "monthly", keywords: ["this month", "monthly"] },
    { value: "yearly", keywords: ["this year", "yearly", "annually", "annual"] },
];

const RANGE_PHRASES = [
    { value: "7daysago", keywords: ["last 7 days", "past 7 days", "last week", "past week", "a week"] },
    { value: "1monthago", keywords: ["last 30 days", "past 30 days", "last month", "past month", "a month"] },
];

const FORMAT_PHRASES = [
    { value: "pdf", keywords: ["pdf"] },
    { value: "excel", keywords: ["excel", "xlsx", "spreadsheet"] },
    { value: "csv", keywords: ["csv"] },
];

export const DATE_RANGE_LABELS = {
    "7daysago": "the last 7 days",
    "1monthago": "the last 30 days",
};

export const FREQUENCY_LABELS = {
    daily: "today",
    weekly: "this week",
    monthly: "this month",
    yearly: "this year",
};

function detectReportType(lower) {
    let bestId = null;
    let bestLen = 0;
    for (const entry of REPORT_TYPE_PHRASES) {
        for (const kw of entry.keywords) {
            if (lower.includes(kw) && kw.length > bestLen) {
                bestLen = kw.length;
                bestId = entry.id;
            }
        }
    }
    return { id: bestId, matched: bestId !== null };
}

function toISODate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

const EMPTY_DATE = { dateMode: null, frequency: null, dateRange: null, startDate: null, endDate: null };

function detectFrequency(lower) {
    for (const entry of FREQUENCY_PHRASES) {
        for (const kw of entry.keywords) {
            if (lower.includes(kw)) {
                return { dateMode: "frequency", frequency: entry.value, dateRange: null, startDate: null, endDate: null };
            }
        }
    }
    return EMPTY_DATE;
}

function detectRangeOrCustom(lower, now) {
    // Two explicit ISO dates ("2026-01-01 ... 2026-02-01") -> custom range.
    const isoDates = lower.match(/\d{4}-\d{2}-\d{2}/g);
    if (isoDates && isoDates.length >= 2) {
        const sorted = [...isoDates].sort();
        return { dateMode: "custom", frequency: null, dateRange: null, startDate: sorted[0], endDate: sorted[1] };
    }

    // "last/past N days" -> custom range computed from N.
    const daysMatch = lower.match(/(?:last|past)\s+(\d{1,3})\s+days?/);
    if (daysMatch) {
        const n = parseInt(daysMatch[1], 10);
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - n);
        return { dateMode: "custom", frequency: null, dateRange: null, startDate: toISODate(start), endDate: toISODate(end) };
    }

    // "last/past N months" -> custom range computed from N.
    const monthsMatch = lower.match(/(?:last|past)\s+(\d{1,2})\s+months?/);
    if (monthsMatch) {
        const n = parseInt(monthsMatch[1], 10);
        const end = new Date(now);
        const start = new Date(now);
        start.setMonth(start.getMonth() - n);
        return { dateMode: "custom", frequency: null, dateRange: null, startDate: toISODate(start), endDate: toISODate(end) };
    }

    // "last/past/this quarter" -> custom range, 3 months back.
    if (/(?:last|past|this)\s+quarter/.test(lower)) {
        const end = new Date(now);
        const start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        return { dateMode: "custom", frequency: null, dateRange: null, startDate: toISODate(start), endDate: toISODate(end) };
    }

    // "yesterday" -> custom single-day range.
    if (lower.includes("yesterday")) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        const iso = toISODate(d);
        return { dateMode: "custom", frequency: null, dateRange: null, startDate: iso, endDate: iso };
    }

    // Canned phrases that map onto the Reports.jsx dropdown's existing
    // "Last 7 days" / "Last 30 days" options (kept as `range` mode, not
    // `custom`, so the UI shows the same dropdown selection a manual user
    // would pick).
    for (const entry of RANGE_PHRASES) {
        for (const kw of entry.keywords) {
            if (lower.includes(kw)) {
                return { dateMode: "range", frequency: null, dateRange: entry.value, startDate: null, endDate: null };
            }
        }
    }

    return EMPTY_DATE;
}

function detectFormat(lower) {
    for (const entry of FORMAT_PHRASES) {
        for (const kw of entry.keywords) {
            if (lower.includes(kw)) return entry.value;
        }
    }
    return null;
}

function detectInmateToken(lower) {
    const m = lower.match(/\b(?:inmate|prisoner|offender)(?:\s*(?:id|number|no\.?))?\s*[:#]?\s*([a-z0-9-]+)\b/i);
    if (!m) return null;
    const token = m[1];
    // Only treat the captured token as an inmate identifier if it contains
    // a digit - avoids false positives like "inmate balance" being read
    // as an ID (inmate IDs in this system always include digits).
    if (!/\d/.test(token)) return null;
    return token.toUpperCase();
}

/**
 * Parse a free-text question into a structured report query.
 *
 * @param {string} text - the raw NL input, e.g. "canteen sales last 7 days as pdf"
 * @param {object} [opts]
 * @param {number|null} [opts.fallbackReportTypeId] - report type to assume when the
 *   text doesn't name one (typically whichever report card is currently selected).
 *   Also decides whether "date" phrases are interpreted as a frequency (daily/
 *   weekly/monthly/yearly, used by Transaction Summary) or a range/custom
 *   date span (used by the other three report types).
 * @param {Date} [opts.now] - clock override for testability.
 */
export function parseReportQuery(text, opts = {}) {
    const { fallbackReportTypeId = null, now = new Date() } = opts;
    const raw = (text || "").trim();
    const lower = raw.toLowerCase();

    const typeMatch = detectReportType(lower);
    const reportTypeId = typeMatch.matched ? typeMatch.id : null;
    const resolvedTypeId = reportTypeId ?? fallbackReportTypeId ?? null;
    const useFrequency = resolvedTypeId === 2;

    const dateResult = useFrequency ? detectFrequency(lower) : detectRangeOrCustom(lower, now);
    const format = detectFormat(lower);
    const inmateToken = detectInmateToken(lower);

    const matchedAny = Boolean(typeMatch.matched || dateResult.dateMode || format || inmateToken);

    return {
        raw,
        reportTypeId,
        reportMatched: typeMatch.matched,
        resolvedTypeId,
        format,
        inmateToken,
        matchedAny,
        ...dateResult,
    };
}

/**
 * Turn a resolved query (parser output merged with whatever filters are
 * actually about to run) into a human-readable preview sentence.
 */
export function describeQuery({ reportTitle, dateMode, dateRange, frequency, startDate, endDate, format, inmateLabel }) {
    let when;
    if (dateMode === "frequency") when = FREQUENCY_LABELS[frequency] || "the selected period";
    else if (dateMode === "range") when = DATE_RANGE_LABELS[dateRange] || "the selected range";
    else if (dateMode === "custom") when = `from ${startDate} to ${endDate}`;
    else when = "the report's default time range";

    const who = inmateLabel ? ` for inmate ${inmateLabel}` : "";
    const fmt = (format || "csv").toUpperCase();

    return `I'll run the ${reportTitle}${who} for ${when}, exported as ${fmt}.`;
}
