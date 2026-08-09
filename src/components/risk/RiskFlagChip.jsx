import { Chip } from "@mui/material";

// Financial Anomaly & Fraud Detection - a small colored chip summarizing a
// transaction's risk level. Shared by TransactionHistory.jsx's Risk column,
// Dashboard.jsx's Flagged for Review panel, and the badge on
// CanteenPosSystem.jsx's Reverse button, so the same colors/labels show up
// everywhere a risk level is shown.
const LEVEL_META = {
    clear: { label: "Clear", color: "default" },
    low: { label: "Low Risk", color: "info" },
    medium: { label: "Medium Risk", color: "warning" },
    high: { label: "High Risk", color: "error" },
};

export default function RiskFlagChip({ risk, onClick, size = "small" }) {
    const level = risk?.level || "clear";
    const meta = LEVEL_META[level] || LEVEL_META.clear;
    const clickable = level !== "clear" && typeof onClick === "function";

    return (
        <Chip
            size={size}
            label={meta.label}
            color={meta.color}
            variant={level === "clear" ? "outlined" : "filled"}
            onClick={clickable ? onClick : undefined}
            clickable={clickable}
        />
    );
}

export { LEVEL_META };
