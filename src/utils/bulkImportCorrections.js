// Bulk Import Error Handling - deterministic, rule-based (no AI/LLM - this
// codebase has none) helpers for BulkOperation.jsx's results grid. All
// functions here are pure (no DOM/React) so they can be unit tested
// standalone, mirroring the pattern already used for riskScoring.js and
// nlReportQuery.js elsewhere in this project.
//
// "AI Suggestion" is plain field-level heuristics that mirror the exact
// validation rules the backend already applies (see
// Inmate_BE/src/controllers/bulkOperationController.js and
// Inmate_BE/src/utils/phoneUtils.js) so a suggestion that reports "high"
// confidence is actually very likely to pass re-validation on re-upload.

/* =======================
   CSV parse / serialize
   Hand-rolled (no new dependency) - handles quoted fields with embedded
   commas/quotes/newlines, matching the shape the backend's csv-parse/sync
   call produces ({ columns: true, skip_empty_lines: true, trim: true }).
======================= */

export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => { row.push(field); field = ""; };
    const pushRow = () => { rows.push(row); row = []; };

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            pushField();
        } else if (ch === "\n") {
            pushField();
            pushRow();
        } else if (ch === "\r") {
            // no-op; \n (possibly preceded by \r) ends the row
        } else {
            field += ch;
        }
    }
    if (field.length || row.length) { pushField(); pushRow(); }

    const nonEmpty = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
    if (!nonEmpty.length) return { headers: [], rows: [] };

    const headers = nonEmpty[0].map((h) => h.trim());
    const dataRows = nonEmpty.slice(1).map((r, idx) => {
        // __row mirrors the backend's `index + 2` row numbering (header = row 1).
        const obj = { __row: idx + 2 };
        headers.forEach((h, colIdx) => { obj[h] = (r[colIdx] ?? "").trim(); });
        return obj;
    });

    return { headers, rows: dataRows };
}

export function serializeCsv(headers, rows) {
    const escape = (val) => {
        const s = val === undefined || val === null ? "" : String(val);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const lines = [headers.map(escape).join(",")];
    rows.forEach((r) => {
        lines.push(headers.map((h) => escape(r[h])).join(","));
    });
    return lines.join("\r\n");
}

/* =======================
   Field-level suggestion heuristics
======================= */

// Mirrors Inmate_BE/src/utils/phoneUtils.js exactly, so a "high confidence"
// suggestion here is the same value the backend would consider valid.
export function normalizePhone(value) {
    if (!value) return { digits: "", valid: false };
    const digits = String(value).replace(/\D/g, "").replace(/^91/, "").replace(/^0+/, "");
    const valid = !!digits && /^[6-9]\d{9}$/.test(digits);
    return { digits, valid };
}

function parseDateLike(value) {
    if (value === undefined || value === null || value === "") return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const d = new Date(str);
        return isNaN(d) ? null : d;
    }
    const m = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) {
        const [, dd, mm, yyyy] = m;
        const d = new Date(`${yyyy}-${mm}-${dd}`);
        return isNaN(d) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d) ? null : d;
}

export function isParseableDate(value) {
    return parseDateLike(value) !== null;
}

// Best-effort reformat of a date the backend couldn't parse into the
// YYYY-MM-DD shape it accepts. Assumes day-first for ambiguous numeric
// dates (matching the backend's own DD-MM-YYYY / DD/MM/YYYY handling).
export function suggestDateFix(value) {
    if (value === undefined || value === null || value === "") return { suggestion: null };
    const str = String(value).trim();

    const m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
        let [, dd, mm, yyyy] = m;
        if (yyyy.length === 2) yyyy = `20${yyyy}`;
        dd = dd.padStart(2, "0");
        mm = mm.padStart(2, "0");
        if (Number(dd) <= 31 && Number(mm) <= 12) {
            const iso = `${yyyy}-${mm}-${dd}`;
            const d = new Date(iso);
            if (!isNaN(d)) return { suggestion: iso };
        }
    }

    const d = new Date(str);
    if (!isNaN(d)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return { suggestion: iso };
    }

    return { suggestion: null };
}

function pick(row, keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
    }
    return undefined;
}

function suggestForMissingField(field) {
    if (field === "status") {
        return { suggestion: "Active", confidence: "medium", note: "Defaulted to Active - verify this is correct." };
    }
    return { suggestion: "", confidence: "low", note: "This field has no safe default - please enter a value." };
}

let seqCounter = 0;
function makeRow({ row, inmateId, field, error, originalValue, suggestion, confidence, note = null, defaultStatus = "pending" }) {
    seqCounter += 1;
    return {
        id: `r${row ?? "x"}-${field}-${seqCounter}`,
        row: row ?? null,
        inmateId: inmateId || "-",
        field,
        error,
        originalValue: originalValue ?? "",
        suggestion: suggestion ?? "",
        confidence, // 'high' | 'medium' | 'low'
        note,
        status: defaultStatus, // 'pending' | 'accepted' | 'edited' | 'skipped'
    };
}

function findLineByInmateId(rawRowsByLine, inmateId) {
    if (!rawRowsByLine) return null;
    for (const [line, row] of rawRowsByLine.entries()) {
        const id = pick(row, ["inmateId", "inmateID", "inmateNumber"]);
        if (id === inmateId) return line;
    }
    return null;
}

/**
 * Turn the backend's `results` object (created/alreadyExists/failed) into
 * one grid row per field-level correction. When `rawRowsByLine` is
 * available (the source file was a CSV we parsed client-side), suggestions
 * can be computed from the actual original values; otherwise (xlsx/xls,
 * which isn't parsed client-side) suggestions fall back to whatever the
 * backend response itself already included.
 *
 * @param {object} results - payload.results from the bulk upload response
 * @param {Map<number, object>|null} rawRowsByLine - __row -> original row, or null
 * @param {string|null} selectedLocationId - the currently selected location's _id
 */
export function buildCorrectionRows(results, rawRowsByLine, selectedLocationId) {
    seqCounter = 0;
    const out = [];
    const rawFor = (line) => (rawRowsByLine ? rawRowsByLine.get(line) : undefined);

    (results?.failed || []).forEach((f) => {
        const line = f.row;
        const raw = rawFor(line);
        const inmateId = f.inmateId && f.inmateId !== "UNKNOWN" ? f.inmateId : pick(raw || {}, ["inmateId", "inmateID", "inmateNumber"]) || "";

        if (f.reason === "Validation failed" && Array.isArray(f.missingFields)) {
            f.missingFields.forEach((field) => {
                out.push(makeRow({
                    row: line, inmateId, field,
                    error: "Missing required value",
                    originalValue: "",
                    ...suggestForMissingField(field),
                }));
            });
            return;
        }

        if (f.reason === "Invalid phone number") {
            const original = f.phoneNumber ?? pick(raw || {}, ["phonenumber", "phoneNumber", "phone"]) ?? "";
            const { digits, valid } = normalizePhone(original);
            out.push(makeRow({
                row: line, inmateId, field: "phonenumber",
                error: "Invalid phone number format",
                originalValue: original,
                suggestion: digits,
                confidence: valid ? "high" : "low",
                note: valid ? null : "Normalized value still doesn't look like a valid 10-digit Indian mobile number - please verify.",
            }));
            return;
        }

        if (f.reason === "Phone number already exists") {
            const original = f.phoneNumber ?? pick(raw || {}, ["phonenumber", "phoneNumber", "phone"]) ?? "";
            out.push(makeRow({
                row: line, inmateId, field: "phonenumber",
                error: "Phone number already registered to another inmate",
                originalValue: original,
                suggestion: "",
                confidence: "low",
                note: "Enter a different phone number for this inmate.",
            }));
            return;
        }

        if (f.reason === "Location mismatch") {
            out.push(makeRow({
                row: line, inmateId, field: "location_id",
                error: "location_id doesn't match your selected location",
                originalValue: pick(raw || {}, ["location_id", "locationId"]) ?? "",
                suggestion: selectedLocationId || "",
                confidence: selectedLocationId ? "high" : "low",
            }));
            return;
        }

        if (f.reason === "Invalid date format") {
            const dateFieldSpecs = [
                { field: "dateOfBirth", keys: ["dateOfBirth", "dob"] },
                { field: "admissionDate", keys: ["admissionDate"] },
            ];
            let matchedAny = false;

            dateFieldSpecs.forEach(({ field, keys }) => {
                if (!raw) return;
                const rawValue = pick(raw, keys);
                if (rawValue === undefined) return;
                if (isParseableDate(rawValue)) return;
                matchedAny = true;
                const fix = suggestDateFix(rawValue);
                out.push(makeRow({
                    row: line, inmateId, field,
                    error: "Unrecognized date format",
                    originalValue: rawValue,
                    suggestion: fix.suggestion || "",
                    confidence: fix.suggestion ? "medium" : "low",
                    note: fix.suggestion ? null : "Could not confidently reformat this date - please edit manually.",
                }));
            });

            if (!matchedAny) {
                out.push(makeRow({
                    row: line, inmateId, field: "dateOfBirth / admissionDate",
                    error: "Unrecognized date format",
                    originalValue: "",
                    suggestion: "",
                    confidence: "low",
                    note: raw
                        ? null
                        : "Original file contents aren't available for this file type - please open the file and fix the date manually.",
                }));
            }
            return;
        }

        // Any other/unknown reason - still surface it rather than dropping it silently.
        out.push(makeRow({
            row: line, inmateId, field: "-",
            error: f.reason || "Unknown error",
            originalValue: "",
            suggestion: "",
            confidence: "low",
        }));
    });

    (results?.alreadyExists || []).forEach((inmateId) => {
        const line = findLineByInmateId(rawRowsByLine, inmateId);
        out.push(makeRow({
            row: line, inmateId, field: "inmateId",
            error: "Inmate ID already exists - row was skipped",
            originalValue: inmateId,
            suggestion: "",
            confidence: "high",
            note: "No action needed unless this was meant to update the existing inmate.",
            defaultStatus: "skipped",
        }));
    });

    return out;
}

/**
 * Patch accepted/edited suggestions back onto the original parsed rows, for
 * "Download corrected file". Only meaningful when the source file was a CSV
 * parsed client-side (rawRowsByLine is non-null) - returns null otherwise
 * so the caller can fall back to a corrections-only export.
 */
export function applyCorrectionsToRawRows(rawRowsByLine, correctionRows) {
    if (!rawRowsByLine) return null;
    const byLine = new Map();
    rawRowsByLine.forEach((row, line) => byLine.set(line, { ...row }));

    correctionRows.forEach((c) => {
        if (c.status !== "accepted" && c.status !== "edited") return;
        if (c.row == null) return;
        if (c.field.includes(" / ")) return; // combined/unknown-field placeholder, not a real column
        const target = byLine.get(c.row);
        if (!target) return;
        target[c.field] = c.suggestion;
    });

    return Array.from(byLine.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, row]) => row);
}
