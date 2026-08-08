// Unified Smart Search - a single reusable search input used across
// UserManagement.jsx, AuditTrails.jsx, and TransactionHistory.jsx (and any
// future list/table page) so every page gets the same look, debouncing,
// and clear behavior instead of each page rolling its own search box.
//
// This component only owns the *text field* - what it searches (which
// fields, client vs. server) is entirely up to the parent. Pass an
// `onSearch(trimmedValue)` callback; SmartSearch debounces keystrokes and
// calls it with the trimmed search text once the user pauses typing.
// Clearing (the X button, or an Escape keypress) bypasses the debounce and
// calls onSearch("") immediately, so "clear" always feels instant.
import { useEffect, useRef, useState } from "react";
import { CircularProgress, IconButton, InputAdornment, TextField } from "@mui/material";
import { Search, X } from "lucide-react";

export default function SmartSearch({
    placeholder = "Search...",
    onSearch,
    debounceMs = 350,
    loading = false,
    size = "small",
    fullWidth = false,
    className = "",
    autoFocus = false,
}) {
    const [text, setText] = useState("");

    // Keep the debounce effect from re-arming just because the parent
    // re-rendered and passed a new inline onSearch function - only actual
    // text changes should restart the timer.
    const onSearchRef = useRef(onSearch);
    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);

    // Don't fire on mount - the parent already starts with no search
    // applied, so there's nothing to tell it.
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const timer = setTimeout(() => {
            onSearchRef.current?.(text.trim());
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [text, debounceMs]);

    const handleClear = () => {
        setText("");
        onSearchRef.current?.("");
    };

    return (
        <TextField
            className={className}
            size={size}
            fullWidth={fullWidth}
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Escape" && text) handleClear();
            }}
            inputProps={{ "aria-label": placeholder }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <Search size={16} className="text-slate-400" />
                    </InputAdornment>
                ),
                endAdornment: (
                    <InputAdornment position="end">
                        {loading ? (
                            <CircularProgress size={16} />
                        ) : text ? (
                            <IconButton size="small" onClick={handleClear} aria-label="Clear search" edge="end">
                                <X size={14} />
                            </IconButton>
                        ) : null}
                    </InputAdornment>
                ),
            }}
        />
    );
}
