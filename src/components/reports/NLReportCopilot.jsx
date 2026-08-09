import { Card, CardContent, TextField, IconButton, Button, Alert, CircularProgress } from "@mui/material";
import { Sparkles, Send } from "lucide-react";

// NL Report & Query Copilot - the "Ask for a report..." box shown above the
// report cards on Reports.jsx. This component is intentionally "dumb": it
// only renders the input + the translated query preview and calls back to
// Reports.jsx, which owns all the actual filter state and the existing
// generate()/export logic (so PDF/CSV/Excel export code paths are never
// touched by this feature).
//
// `preview` shape (or null when nothing has been asked yet):
//   { sentence: string, note?: string, isResolving?: boolean, matchedAny: boolean }
export default function NLReportCopilot({
    value,
    onChange,
    onAsk,
    preview,
    onRun,
    onDismiss,
    running,
}) {
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onAsk();
        }
    };

    return (
        <Card className="mb-5">
            <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary shrink-0" />
                    <TextField
                        fullWidth
                        size="small"
                        placeholder='Ask for a report... e.g. "canteen sales last 7 days as pdf" or "balance report for inmate INM1023"'
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <IconButton color="primary" onClick={onAsk} disabled={!value.trim()} aria-label="Translate query">
                        <Send className="w-5 h-5" />
                    </IconButton>
                </div>

                {preview && (
                    <Alert
                        severity={preview.matchedAny ? "info" : "warning"}
                        action={
                            <div className="flex items-center gap-2">
                                <Button size="small" onClick={onDismiss} disabled={running}>
                                    Dismiss
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={onRun}
                                    disabled={running || preview.isResolving}
                                    startIcon={running || preview.isResolving ? <CircularProgress size={14} /> : null}
                                >
                                    {running ? "Running..." : "Run Report"}
                                </Button>
                            </div>
                        }
                    >
                        <div className="font-medium">{preview.sentence}</div>
                        {preview.note && <div className="text-sm mt-1 opacity-80">{preview.note}</div>}
                        {!preview.matchedAny && (
                            <div className="text-sm mt-1 opacity-80">
                                I couldn't pick anything specific out of that - try mentioning a report (balance,
                                transactions, canteen sales, inventory), a time range, and/or a format (PDF/CSV/Excel).
                            </div>
                        )}
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
