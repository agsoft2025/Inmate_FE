// Vendor Invoice / Deposit-Slip Extraction
//
// Runs OCR entirely in the browser (no backend changes, no API key) using
// Tesseract.js, then applies lightweight pattern-matching to pull out the
// fields these forms already have. This is a best-effort estimate, not a
// guaranteed-accurate parse - accuracy depends heavily on photo/scan
// quality, layout, and language. Every extracted value is meant to be
// dropped into the form via setValue() and left fully editable; nothing
// here submits or saves anything on its own.
import { createWorker } from "tesseract.js";

// Runs OCR on an image File/Blob and returns the raw recognized text.
// Creates and tears down a worker per call - simple and fine for a single
// manual "scan" action (not a bulk/continuous scanning use case).
export async function runOcr(file) {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return data?.text || "";
  } finally {
    await worker.terminate();
  }
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function toInputDate(y, mo, d) {
  const year = String(y).padStart(4, "0");
  const month = String(mo).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  return `${year}-${month}-${day}`;
}

// Finds the first recognizable date in the text and normalizes it to
// YYYY-MM-DD (the value <input type="date"> expects). Numeric dd/mm/yyyy
// style dates are read day-first, matching the Indian-locale convention
// used throughout the rest of this app (₹ currency, DD/MM inputs).
export function findDate(text) {
  let m = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) return toInputDate(m[1], m[2], m[3]);

  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return toInputDate(y, mo, d);
  }

  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return toInputDate(m[3], mo, m[1]);
  }

  m = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return toInputDate(m[3], mo, m[2]);
  }

  return null;
}

// Looks for "<label>: <value>" style lines (case-insensitive, labels may
// be regex fragments). Returns the first match found, or null.
function findLabeledValue(text, labelPatterns) {
  const lines = text.split(/\r?\n/);
  for (const label of labelPatterns) {
    const re = new RegExp(`${label}\\s*[:\\-]?\\s*([A-Za-z0-9][A-Za-z0-9 &.,'\\-\\/]{1,40})`, "i");
    for (const line of lines) {
      const m = line.match(re);
      if (m && m[1]) {
        const value = m[1].trim().replace(/[.,]+$/, "");
        if (value) return value;
      }
    }
  }
  return null;
}

// Fallback for vendor name when no explicit "Vendor:"/"Supplier:" label is
// found - invoice letterheads are usually the first substantial line.
function guessVendorNameFallback(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/^[\d\s\-/.:,]+$/.test(line)) continue; // number/date-only line
    if (line.length < 3) continue;
    return line.slice(0, 60);
  }
  return null;
}

// Searches for a currency amount on lines containing any of the given
// keywords, trying each keyword group in priority order (e.g. "grand
// total" before generic "total"). Returns the LAST matching line's amount
// within the first group that matches anything, since totals typically
// appear after subtotals in a document's reading order.
function findAmountNear(text, keywordGroups) {
  const lines = text.split(/\r?\n/);
  // Comma-grouped alternative must come first and require >=1 comma group -
  // otherwise "1200" (no commas) would wrongly match only "120" via the
  // \d{1,3} branch before the engine ever tries the plain-digits fallback.
  const amountPattern = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;

  for (const keywords of keywordGroups) {
    let found = null;
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (keywords.some((kw) => lower.includes(kw))) {
        const match = line.match(amountPattern);
        if (match) {
          const num = parseFloat(match[1].replace(/,/g, ""));
          if (Number.isFinite(num) && num > 0) found = num;
        }
      }
    }
    if (found !== null) return found;
  }
  return null;
}

// Extracts the fields used by StoreInventoryDialog.jsx's invoice form.
// Only returns keys it found a plausible value for - callers should only
// setValue() the returned keys, leaving anything else as the user typed it.
export function parseInvoiceFields(text) {
  const result = {};

  const date = findDate(text);
  if (date) result.date = date;

  const invoiceNo = findLabeledValue(text, [
    "invoice\\s*no\\.?", "invoice\\s*number", "inv\\s*no\\.?", "bill\\s*no\\.?",
  ]);
  if (invoiceNo) result.invoiceNo = invoiceNo;

  const vendorName =
    findLabeledValue(text, [
      "vendor\\s*name", "vendor", "supplier\\s*name", "supplier", "bill\\s*from", "sold\\s*by",
    ]) || guessVendorNameFallback(text);
  if (vendorName) result.vendorName = vendorName;

  const vendorValue = findAmountNear(text, [
    ["grand total", "total amount", "net payable", "amount payable"],
    ["total", "amount due", "balance due"],
  ]);
  if (vendorValue !== null) result.vendorValue = vendorValue;

  const gatePassNumber = findLabeledValue(text, [
    "gate\\s*pass\\s*no\\.?", "gate\\s*pass\\s*number", "gp\\s*no\\.?", "gp\\s*number",
  ]);
  if (gatePassNumber) result.gatePassNumber = gatePassNumber;

  return result;
}

// Matches an inmate-id-shaped token (e.g. INM001, STU001), consistent with
// the id format used elsewhere in this app.
function findInmateIdToken(text) {
  const m = text.match(/\b[A-Z]{2,5}\d{2,6}\b/);
  return m ? m[0] : null;
}

function findDepositType(text) {
  const lower = text.toLowerCase();
  if (/\bcash\b/.test(lower)) return "Cash";
  if (/\b(bank|cheque|check|neft|rtgs|imps|transfer|deposit slip)\b/.test(lower)) return "Bank";
  return null;
}

// FinanicalManagement.jsx's Relationship dropdown values, and the keywords
// on a deposit slip that would indicate each one. Note "teacher" is the
// stored value behind the UI's "Advocate" option - matched here exactly as
// the existing form already treats it, not something introduced by this
// feature.
const RELATIONSHIP_KEYWORDS = [
  { value: "mother", keywords: ["mother", "mom"] },
  { value: "father", keywords: ["father", "dad"] },
  { value: "sibling", keywords: ["sibling", "brother", "sister"] },
  { value: "teacher", keywords: ["advocate", "lawyer"] },
  { value: "friend", keywords: ["friend"] },
];

function findRelationship(text) {
  const lower = text.toLowerCase();
  for (const entry of RELATIONSHIP_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.value;
  }
  return null;
}

// Extracts the fields used by FinanicalManagement.jsx's deposit form. Same
// "only return what was confidently found" contract as parseInvoiceFields.
export function parseDepositSlipFields(text) {
  const result = {};

  const inmateId = findInmateIdToken(text);
  if (inmateId) result.query = inmateId;

  const depositType = findDepositType(text);
  if (depositType) result.depositType = depositType;

  const relationShipId = findRelationship(text);
  if (relationShipId) result.relationShipId = relationShipId;

  const depositAmount = findAmountNear(text, [
    ["deposit amount", "amount deposited", "total deposit"],
    ["amount", "deposit", "total"],
  ]);
  if (depositAmount !== null) result.depositAmount = depositAmount;

  const remarks = findLabeledValue(text, ["remarks", "narration", "purpose", "note"]);
  if (remarks) result.remarks = remarks;

  return result;
}
