import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fab, Paper, TextField, IconButton, Button, ClickAwayListener } from "@mui/material";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { REPORT_TYPES } from "../../constants/reportTypes";
import { parseReportQuery, describeQuery } from "../../utils/nlReportQuery";

// NL Report & Query Copilot - small floating icon available from any admin
// page for quick report questions. It reuses the exact same deterministic
// parser as Reports.jsx's inline "Ask for a report..." box, so the preview
// shown here always matches what Reports.jsx would show for the same text.
//
// This widget deliberately does NOT generate/download reports itself - it
// only previews the translated query, then hands the raw question off to
// Reports.jsx (via router navigation state) so the actual report run still
// goes through Reports.jsx's single, unchanged generate() implementation
// and its existing PDF/CSV/Excel export code.
export default function CopilotFab() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [preview, setPreview] = useState(null);

    const close = () => {
        setOpen(false);
        setQuery("");
        setPreview(null);
    };

    const handleAsk = () => {
        if (!query.trim()) return;
        const parsed = parseReportQuery(query);
        const reportTitle =
            REPORT_TYPES.find((r) => r.id === parsed.reportTypeId)?.title || "currently selected report";

        const sentence = describeQuery({
            reportTitle,
            dateMode: parsed.dateMode,
            dateRange: parsed.dateRange,
            frequency: parsed.frequency,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            format: parsed.format,
            inmateLabel: parsed.inmateToken,
        });

        setPreview({ sentence, matchedAny: parsed.matchedAny });
    };

    const handleOpenInReports = () => {
        navigate("/reports", { state: { nlQuery: query } });
        close();
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {open ? (
                <ClickAwayListener onClickAway={close}>
                    <Paper elevation={6} className="w-80 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Ask a quick question</span>
                            <IconButton size="small" onClick={close} aria-label="Close copilot">
                                <X className="w-4 h-4" />
                            </IconButton>
                        </div>

                        <div className="flex items-center gap-2">
                            <TextField
                                fullWidth
                                size="small"
                                autoFocus
                                placeholder='e.g. "inventory report last month as excel"'
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAsk();
                                    }
                                }}
                            />
                            <IconButton color="primary" onClick={handleAsk} disabled={!query.trim()} aria-label="Translate query">
                                <Send className="w-4 h-4" />
                            </IconButton>
                        </div>

                        {preview && (
                            <div className="text-sm border rounded p-2 bg-slate-50">
                                <div>{preview.sentence}</div>
                                {!preview.matchedAny && (
                                    <div className="text-xs opacity-70 mt-1">
                                        Couldn't pick anything specific out of that - try naming a report, a time range,
                                        or a format.
                                    </div>
                                )}
                                <Button size="small" className="mt-2" variant="contained" onClick={handleOpenInReports}>
                                    Open in Reports
                                </Button>
                            </div>
                        )}
                    </Paper>
                </ClickAwayListener>
            ) : (
                <Fab color="primary" onClick={() => setOpen(true)} aria-label="Ask the report copilot">
                    <MessageCircleQuestion className="w-5 h-5" />
                </Fab>
            )}
        </div>
    );
}
