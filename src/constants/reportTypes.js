// Shared report type definitions for the Reports page and the NL Report &
// Query Copilot (Reports.jsx + components/copilot/CopilotFab.jsx). Keeping
// this list in one place means the copilot's natural-language parser always
// stays in sync with whatever report types actually exist on the Reports
// page, instead of maintaining two copies that can drift apart.
//
// Previously this array lived only inline inside Reports.jsx. Its ids/
// titles/apiUrls are unchanged - it was just lifted out so it can be
// imported from more than one place.
export const REPORT_TYPES = [
    { id: 1, title: "Inmate Balance Report", apiUrl: "reports/intimate-balance-report" },
    { id: 2, title: "Transaction Summary", apiUrl: "reports/transaction-summary-report" },
    { id: 3, title: "Canteen Sales", apiUrl: "reports/tuckshop-sales-report" },
    { id: 5, title: "Inventory", apiUrl: "reports/inventory-report" },
];
