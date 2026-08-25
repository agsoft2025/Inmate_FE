// Vendor Invoice / Deposit-Slip Extraction
//
// Runs OCR entirely in the browser (no backend changes, no API key) using
// Tesseract.js, then applies lightweight pattern-matching to pull out the
// fields these forms already have. This is a best-effort estimate, not a
// guaranteed-accurate parse - accuracy depends heavily on photo/scan
// quality, layout, and language. Every extracted value is meant to be
// dropped into the form via setValue() and left fully editable; nothing
// here submits or saves anything on its own.
//
// Each extracted field also carries a 0-100 confidence score sourced from
// Tesseract.js's own per-word confidence output where a matching word can
// be found, falling back to the whole-page confidence otherwise (see
// estimateFieldConfidence). Callers use getConfidenceTier() to decide how
// to badge/highlight each field for review.
import { createWorker } from "tesseract.js";

// Runs OCR on an image File/Blob. Requests Tesseract's word-level "blocks"
// output (in addition to plain text) specifically so field-level confidence
// can be estimated - by default Tesseract.js only returns `text`. Creates
// and tears down a worker per call - simple and fine for a single manual
// "scan" action (not a bulk/continuous scanning use case).
export async function runOcr(file) {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file, {}, { text: true, blocks: true });
    return {
      text: data?.text || "",
      // Whole-page mean confidence (0-100), used as a fallback when a field
      // can't be matched back to specific OCR words.
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      words: flattenWords(data?.blocks),
    };
  } finally {
    await worker.terminate();
  }
}

// Tesseract's output is blocks -> paragraphs -> lines -> words. Flatten to
// a simple { text, confidence }[] list for matching extracted field values
// back to the words that produced them.
function flattenWords(blocks) {
  const words = [];
  (blocks || []).forEach((block) => {
    (block.paragraphs || []).forEach((paragraph) => {
      (paragraph.lines || []).forEach((line) => {
        (line.words || []).forEach((word) => {
          if (word?.text) {
            words.push({
              text: word.text,
              confidence: typeof word.confidence === "number" ? word.confidence : null,
            });
          }
        });
      });
    });
  });
  return words;
}

function normalizeToken(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Estimates a 0-100 confidence for one extracted field by averaging the
// Tesseract word-confidences of the OCR words that make up `rawText` (the
// literal substring pulled from the page, before any normalization like
// date reformatting). Falls back to the whole-page confidence when no
// matching words can be found, and to null when neither is available.
export function estimateFieldConfidence(rawText, words, pageConfidence) {
  const fallback = typeof pageConfidence === "number" ? Math.round(pageConfidence) : null;
  if (!rawText || !Array.isArray(words) || words.length === 0) return fallback;

  const tokens = String(rawText).split(/\s+/).map(normalizeToken).filter(Boolean);
  if (!tokens.length) return fallback;

  const matched = [];
  tokens.forEach((token) => {
    // Prefer an exact normalized match first - only fall back to loose
    // substring tolerance (which tolerates Tesseract splitting/merging
    // tokens differently than our regex did, e.g. "INV-2026-0456" vs
    // separate word chunks) when no exact match exists, so a short word
    // like "GP" doesn't shadow the real match "GP-9981" earlier in the list.
    let hit = words.find((w) => normalizeToken(w.text) === token);
    if (!hit) {
      hit = words.find((w) => {
        const wt = normalizeToken(w.text);
        return wt && (wt.includes(token) || token.includes(wt));
      });
    }
    if (hit && typeof hit.confidence === "number") matched.push(hit.confidence);
  });

  if (!matched.length) return fallback;
  return Math.round(matched.reduce((sum, c) => sum + c, 0) / matched.length);
}

// Maps a 0-100 confidence (or null) to a display tier - label + MUI Chip
// `color` value - shared by both StoreInventoryDialog.jsx and
// FinanicalManagement.jsx so the two forms badge fields identically.
export function getConfidenceTier(confidence) {
  if (confidence === null || confidence === undefined) {
    return { level: "unknown", label: "Confidence unknown", color: "default" };
  }
  if (confidence >= 80) return { level: "high", label: `${confidence}% confidence`, color: "success" };
  if (confidence >= 50) return { level: "medium", label: `${confidence}% confidence`, color: "warning" };
  return { level: "low", label: `${confidence}% confidence`, color: "error" };
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Inmate ID formats: consistent with the pattern used throughout the app
const INMATE_ID_REGEX = /\b(?:INM-)?[A-Z]{2,5}\d{2,6}\b/;

function toInputDate(y, mo, d) {
  const year = String(y).padStart(4, "0");
  const month = String(mo).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  return `${year}-${month}-${day}`;
}

// Finds the first recognizable date and returns both the normalized
// YYYY-MM-DD value and the raw matched substring (needed to look up OCR
// word confidence for that span). Numeric dd/mm/yyyy style dates are read
// day-first, matching the Indian-locale convention used throughout the
// rest of this app (₹ currency, DD/MM inputs).
function findDateMatch(text) {
  let m = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) {
    const value = toInputDate(m[1], m[2], m[3]);
    if (value) return { value, raw: m[0] };
  }

  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    const value = toInputDate(y, mo, d);
    if (value) return { value, raw: m[0] };
  }

  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) {
      const value = toInputDate(m[3], mo, m[1]);
      if (value) return { value, raw: m[0] };
    }
  }

  m = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) {
      const value = toInputDate(m[3], mo, m[2]);
      if (value) return { value, raw: m[0] };
    }
  }

  return null;
}

// Kept as its own export with the original bare-string/null contract -
// several callers (and tests) just want the normalized date.
export function findDate(text) {
  return findDateMatch(text)?.value ?? null;
}

// Looks for "<label>: <value>" style lines (case-insensitive, labels may
// be regex fragments). Returns the first match found, or null. The
// returned string doubles as the "raw" text for confidence matching, since
// it's exactly the substring that appeared in the OCR output.
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
// (as both the parsed number and the raw matched text, for confidence
// lookups) within the first group that matches anything, since totals
// typically appear after subtotals in a document's reading order.
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
          if (Number.isFinite(num) && num > 0) found = { value: num, raw: match[1] };
        }
      }
    }
    if (found !== null) return found;
  }
  return null;
}

// Bundles an extracted value with its estimated confidence - the shape
// every field in parseInvoiceFields()/parseDepositSlipFields() returns.
function withConfidence(value, raw, words, pageConfidence) {
  return { value, confidence: estimateFieldConfidence(raw, words, pageConfidence) };
}

// Extracts the fields used by StoreInventoryDialog.jsx's invoice form.
// Only returns keys it found a plausible value for - callers should only
// setValue() the returned keys, leaving anything else as the user typed it.
// `words`/`pageConfidence` (from runOcr()) are optional - omit them and
// every field's confidence simply comes back null ("unknown").
export function parseInvoiceFields(text, words = [], pageConfidence = null) {
  const result = {};

  const dateMatch = findDateMatch(text);
  if (dateMatch) result.date = withConfidence(dateMatch.value, dateMatch.raw, words, pageConfidence);

  const invoiceNo = findLabeledValue(text, [
    "invoice\\s*no\\.?", "invoice\\s*number", "inv\\s*no\\.?", "bill\\s*no\\.?",
  ]);
  if (invoiceNo) result.invoiceNo = withConfidence(invoiceNo, invoiceNo, words, pageConfidence);

  const vendorName =
    findLabeledValue(text, [
      "vendor\\s*name", "vendor", "supplier\\s*name", "supplier", "bill\\s*from", "sold\\s*by",
    ]) || guessVendorNameFallback(text);
  if (vendorName) result.vendorName = withConfidence(vendorName, vendorName, words, pageConfidence);

  const vendorValueMatch = findAmountNear(text, [
    ["grand total", "total amount", "net payable", "amount payable"],
    ["total", "amount due", "balance due"],
  ]);
  if (vendorValueMatch) {
    result.vendorValue = withConfidence(vendorValueMatch.value, vendorValueMatch.raw, words, pageConfidence);
  }

  const gatePassNumber = findLabeledValue(text, [
    "gate\\s*pass\\s*no\\.?", "gate\\s*pass\\s*number", "gp\\s*no\\.?", "gp\\s*number",
  ]);
  if (gatePassNumber) result.gatePassNumber = withConfidence(gatePassNumber, gatePassNumber, words, pageConfidence);

  return result;
}

// Matches an inmate-id-shaped token (e.g. INM-001, STU001), consistent with
// the id format used elsewhere in this app.
function findInmateIdToken(text = "") {
  const normalized = text
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");

  const match = normalized.match(
    /inmate\s*id|inmateld|inmateid/i
  );

  if (!match) return null;

  const afterLabel = normalized.slice(match.index + match[0].length);

  const valueMatch = afterLabel.match(
    /[:\-]?\s*(INM[A-Z0-9]{3,})/i
  );

  if (!valueMatch) return null;

  return valueMatch[1].toUpperCase();
}

// Returns { value, raw } - `value` is the canonical form dropped into the
// form (Bank/Cash), `raw` is the keyword actually seen in the OCR text
// (used for confidence lookup, since the canonical value itself may never
// literally appear on the page).
function findDepositTypeMatch(text) {
  const lower = text.toLowerCase();
  if (/\bcash\b/.test(lower)) return { value: "Cash", raw: "cash" };
  const m = lower.match(/\b(bank|cheque|check|neft|rtgs|imps|transfer|deposit slip)\b/);
  if (m) return { value: "Bank", raw: m[0] };
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

function findRelationshipMatch(text) {
  const lower = text.toLowerCase();
  for (const entry of RELATIONSHIP_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return { value: entry.value, raw: kw };
    }
  }
  return null;
}

// Extracts the fields used by FinanicalManagement.jsx's deposit form. Same
// "only return what was confidently found" contract as parseInvoiceFields,
// and the same optional words/pageConfidence arguments.
export function parseDepositSlipFields(text, words = [], pageConfidence = null) {
  const result = {};

  const inmateId = findInmateIdToken(text);
  console.log("inmateId",inmateId,text)
  if (inmateId) {
    result.inmateId = withConfidence(
      inmateId,
      inmateId,
      words,
      pageConfidence
    );
  }

  const depositTypeMatch = findDepositTypeMatch(text);
  if (depositTypeMatch) {
    result.depositType = withConfidence(depositTypeMatch.value, depositTypeMatch.raw, words, pageConfidence);
  }

  const relationshipMatch = findRelationshipMatch(text);
  if (relationshipMatch) {
    result.relationShipId = withConfidence(relationshipMatch.value, relationshipMatch.raw, words, pageConfidence);
  }

  const depositAmountMatch = findAmountNear(text, [
    ["deposit amount", "amount deposited", "total deposit"],
    ["amount", "deposit", "total"],
  ]);
  if (depositAmountMatch) {
    result.depositAmount = withConfidence(depositAmountMatch.value, depositAmountMatch.raw, words, pageConfidence);
  }

  const remarks = findLabeledValue(text, ["remarks", "narration", "purpose", "note"]);
  if (remarks) result.remarks = withConfidence(remarks, remarks, words, pageConfidence);

  return result;
}
