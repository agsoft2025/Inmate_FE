import { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Chip,
    Stack,
    Typography,
    TextField,
    CircularProgress,
    Divider,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useOfficerFeedbackHistoryQuery, useOfficerFeedbackMutation } from "../../hooks/useRiskQueries";
import { LEVEL_META } from "./RiskFlagChip";

// Financial Anomaly & Fraud Detection - the shared review modal opened by
// clicking a flagged transaction anywhere in the app (TransactionHistory's
// Risk column, Dashboard's Flagged for Review panel, and
// CanteenPosSystem's Reverse-button badge). Shows the risk explanation and
// triggered signals, plus Confirm / False Positive / Investigate actions
// that are recorded via officer_feedback.
//
// `transaction` shape: { id, source: "POS"|"FINANCIAL", inmateId, amount, risk: { score, level, signals } }
const STATUS_LABELS = {
    confirmed: "Confirmed risk",
    false_positive: "False positive",
    investigate: "Marked for investigation",
};

export default function RiskReviewPanel({ open, onClose, transaction }) {
    const { enqueueSnackbar } = useSnackbar();
    const [note, setNote] = useState("");
    const feedbackMutation = useOfficerFeedbackMutation();
    const historyQuery = useOfficerFeedbackHistoryQuery(open ? transaction?.id : null);

    // Clear the note whenever a different transaction is opened.
    useEffect(() => {
        setNote("");
    }, [transaction?.id]);

    const risk = transaction?.risk || { score: 0, level: "clear", signals: [] };
    const levelMeta = LEVEL_META[risk.level] || LEVEL_META.clear;

    const handleClose = () => {
        if (feedbackMutation.isPending) return;
        onClose?.();
    };

    const handleAction = (status) => {
        if (!transaction?.id || !transaction?.source) return;

        feedbackMutation.mutate(
            {
                transactionId: transaction.id,
                transactionSource: transaction.source,
                inmateId: transaction.inmateId,
                riskScore: risk.score,
                riskLevel: risk.level,
                signals: risk.signals,
                status,
                note: note.trim() || undefined,
            },
            {
                onSuccess: () => {
                    enqueueSnackbar(`Marked as: ${STATUS_LABELS[status]}`, { variant: "success" });
                    setNote("");
                },
                onError: (err) => {
                    enqueueSnackbar(err?.response?.data?.message || "Failed to save review", {
                        variant: "error",
                    });
                },
            }
        );
    };

    return (
        <Dialog open={Boolean(open)} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>Review Flagged Transaction</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={levelMeta.label} color={levelMeta.color} />
                        <Typography variant="body2" color="text.secondary">
                            Risk score: {risk.score}
                        </Typography>
                    </Stack>

                    <Stack direction="row" spacing={4}>
                        <div>
                            <Typography variant="subtitle2">Inmate</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {transaction?.inmateId || "-"}
                            </Typography>
                        </div>
                        <div>
                            <Typography variant="subtitle2">Amount</Typography>
                            <Typography variant="body2" color="text.secondary">
                                ₹{Math.abs(transaction?.amount ?? 0)}
                            </Typography>
                        </div>
                        <div>
                            <Typography variant="subtitle2">Source</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {transaction?.source || "-"}
                            </Typography>
                        </div>
                    </Stack>

                    <div>
                        <Typography variant="subtitle2" gutterBottom>
                            Why this was flagged
                        </Typography>
                        {risk.signals.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No specific signals triggered.
                            </Typography>
                        ) : (
                            <Stack spacing={0.5}>
                                {risk.signals.map((s) => (
                                    <Typography key={s.code} variant="body2">
                                        • {s.label}
                                    </Typography>
                                ))}
                            </Stack>
                        )}
                    </div>

                    <Divider />

                    <div>
                        <Typography variant="subtitle2" gutterBottom>
                            Previous reviews
                        </Typography>
                        {historyQuery.isLoading ? (
                            <Typography variant="body2" color="text.secondary">
                                Loading...
                            </Typography>
                        ) : historyQuery.data?.data?.length ? (
                            <Stack spacing={0.5}>
                                {historyQuery.data.data.slice(0, 3).map((f) => (
                                    <Typography key={f._id} variant="caption" color="text.secondary" display="block">
                                        {STATUS_LABELS[f.status] || f.status} by {f.officerUsername || "an officer"} on{" "}
                                        {new Date(f.createdAt).toLocaleString()}
                                        {f.note ? ` — "${f.note}"` : ""}
                                    </Typography>
                                ))}
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Not reviewed yet.
                            </Typography>
                        )}
                    </div>

                    <TextField
                        label="Note (optional)"
                        multiline
                        minRows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        fullWidth
                        size="small"
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
                <Button onClick={handleClose} disabled={feedbackMutation.isPending}>
                    Close
                </Button>
                <Button
                    variant="outlined"
                    color="success"
                    onClick={() => handleAction("confirmed")}
                    disabled={feedbackMutation.isPending}
                >
                    Confirm Risk
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => handleAction("false_positive")}
                    disabled={feedbackMutation.isPending}
                >
                    False Positive
                </Button>
                <Button
                    variant="contained"
                    color="warning"
                    onClick={() => handleAction("investigate")}
                    disabled={feedbackMutation.isPending}
                    startIcon={feedbackMutation.isPending ? <CircularProgress size={14} /> : null}
                >
                    Investigate
                </Button>
            </DialogActions>
        </Dialog>
    );
}
