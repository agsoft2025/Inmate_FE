// Mock OCR data for manually testing the Scan Invoice / Scan Deposit Slip
// confidence-indicator UI (StoreInventoryDialog.test.jsx and
// FinanicalManagement.test.jsx) without needing a real camera/photo or a
// working Tesseract.js pipeline. Each mock function has the exact same
// return shape as documentScanUtils.js's real runOcr() - { text,
// confidence, words } - so it's a drop-in replacement for that call.
//
// The actual field extraction (parseInvoiceFields/parseDepositSlipFields)
// and confidence tiering (getConfidenceTier) are NOT mocked here - the test
// components import those from the real documentScanUtils.js, so this
// harness exercises the same parsing/scoring logic the production OCR flow
// uses, just fed with canned text instead of a real Tesseract recognition.
//
// Swap the mockRunOcr* calls in the .test.jsx files back to the real
// runOcr() once the live camera/OCR flow has been verified end-to-end.

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Invoice: "good" scan --------------------------------------------------
// Deliberately produces one field at each scored tier so the badge colors
// and the low-confidence highlight can both be checked in a single pass:
// invoiceNo -> low, gatePassNumber & vendorValue -> medium, date &
// vendorName -> high.
const MOCK_INVOICE_TEXT_GOOD = `
Sunrise Traders Pvt Ltd
221 Market Road, Springfield

Invoice No: INV-2026-0891
Date: 12/03/2026
GP Number: GP-4471

Item                Qty   Price
Notebooks            50   40
Pens                100   10

Subtotal:                3000
Grand Total: Rs. 8,750.00
`;

const MOCK_INVOICE_WORDS_GOOD = [
  { text: "Sunrise", confidence: 91 },
  { text: "Traders", confidence: 90 },
  { text: "Pvt", confidence: 88 },
  { text: "Ltd", confidence: 89 },
  { text: "Invoice", confidence: 60 },
  { text: "No:", confidence: 58 },
  { text: "INV-2026-0891", confidence: 32 }, // low confidence -> should highlight
  { text: "Date:", confidence: 90 },
  { text: "12/03/2026", confidence: 96 }, // high confidence
  { text: "GP", confidence: 65 },
  { text: "Number:", confidence: 63 },
  { text: "GP-4471", confidence: 68 }, // medium confidence
  { text: "Grand", confidence: 80 },
  { text: "Total:", confidence: 79 },
  { text: "Rs.", confidence: 75 },
  { text: "8,750.00", confidence: 78 }, // medium confidence
];

const MOCK_INVOICE_PAGE_CONFIDENCE_GOOD = 74;

export async function mockRunOcrInvoiceGood(file, { delayMs = 900 } = {}) {
  await delay(delayMs);
  return {
    text: MOCK_INVOICE_TEXT_GOOD,
    confidence: MOCK_INVOICE_PAGE_CONFIDENCE_GOOD,
    words: MOCK_INVOICE_WORDS_GOOD,
  };
}

// --- Invoice: "unknown confidence" scan ------------------------------------
// Simulates a scan so poor Tesseract couldn't produce any word- or
// page-level confidence at all. Every extracted field should fall back to
// the "Confidence unknown" badge instead of crashing or showing a made-up
// number.
const MOCK_INVOICE_TEXT_UNKNOWN = `
Faded Scan - Unreadable Header

Invoice No: INV-9002
Date: 05/11/2025
GP Number: GP-1187
Total: 640
`;

export async function mockRunOcrInvoiceUnknown(file, { delayMs = 900 } = {}) {
  await delay(delayMs);
  return {
    text: MOCK_INVOICE_TEXT_UNKNOWN,
    confidence: null,
    words: [],
  };
}

// --- Deposit slip: "good" scan ---------------------------------------------
// Same idea as the invoice sample: query -> low, relationShipId &
// depositAmount -> medium, depositType -> high, remarks -> low.
const MOCK_DEPOSIT_TEXT_GOOD = `
STATE BANK - DEPOSIT SLIP
Account / Inmate ID: STU233
Amount Deposited: Rs. 3,400
Deposit Type: Cash
Relationship: Father
Remarks: Weekly allowance
`;

const MOCK_DEPOSIT_WORDS_GOOD = [
  { text: "STU233", confidence: 30 }, // low confidence -> should highlight
  { text: "Amount", confidence: 70 },
  { text: "Deposited:", confidence: 68 },
  { text: "Rs.", confidence: 66 },
  { text: "3,400", confidence: 65 }, // medium confidence
  { text: "Cash", confidence: 93 }, // high confidence
  { text: "Father", confidence: 55 }, // medium confidence
  { text: "Remarks:", confidence: 50 },
  { text: "Weekly", confidence: 44 },
  { text: "allowance", confidence: 50 }, // averages to low confidence
];

const MOCK_DEPOSIT_PAGE_CONFIDENCE_GOOD = 60;

export async function mockRunOcrDepositGood(file, { delayMs = 900 } = {}) {
  await delay(delayMs);
  return {
    text: MOCK_DEPOSIT_TEXT_GOOD,
    confidence: MOCK_DEPOSIT_PAGE_CONFIDENCE_GOOD,
    words: MOCK_DEPOSIT_WORDS_GOOD,
  };
}

// --- Deposit slip: "unknown confidence" scan --------------------------------
const MOCK_DEPOSIT_TEXT_UNKNOWN = `
NEFT Transfer Receipt
For inmate ID: TST999
Sent by advocate on behalf of family
Amount Deposited 1250
`;

export async function mockRunOcrDepositUnknown(file, { delayMs = 900 } = {}) {
  await delay(delayMs);
  return {
    text: MOCK_DEPOSIT_TEXT_UNKNOWN,
    confidence: null,
    words: [],
  };
}
