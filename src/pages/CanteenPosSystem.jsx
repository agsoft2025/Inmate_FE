import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Box, Button, Divider, Grid, Paper, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";

import {
    useCreatePosCartMutation,
    usePostCartQuery,
    useReversePostCartMutation,
    useTuckShopItemsQuery,
} from "../hooks/usePostCartQuery";

import { useStudentExactQuery } from "../hooks/useStudentExactQuery";
import useDebounce from "../hooks/useDebounce";

import PosLeftCard from "../components/pos/PosLeftCard";
import { useLocationCtx } from "../context/LocationContext";
import FaceRecognition from "../components/faceIdComponent/FaceID";
import { fetchStudentByFace } from "../service/studentService";

const CanteenPosSystem = () => {
    const { enqueueSnackbar } = useSnackbar();

    // =========================
    // Recent Purchases (TOP)
    // =========================
    const [purchaseSearch, setPurchaseSearch] = useState("");
    const [refetchKey, setRefetchKey] = useState(0);
    const [openFaceId, setOpenFaceId] = useState(false);
    const [faceidData, setFaceIdData] = useState(null);    

    const {
        data: purchasesData,
        error: purchasesError,
        isLoading: purchasesLoading,
        isFetching: purchasesFetching,
    } = usePostCartQuery({ refetchKey });
    const { selectedLocation } = useLocationCtx();

    // IMPORTANT:
    // If your hook returns array directly, keep purchasesData || []
    // If your hook returns { success, data }, keep purchasesData?.data || []
    const purchases = purchasesData?.data || purchasesData || [];

    const reverseMutation = useReversePostCartMutation();
    const fetchingFaceRef = useRef(false);
    const selectedInmateIdRef = useRef(null);

    useEffect(() => {
        if (!faceidData) return;

        // ✅ stop repeated calls if FaceRecognition emits multiple times
        if (fetchingFaceRef.current) return;
        fetchingFaceRef.current = true;

        let alive = true;

        (async () => {
            try {
                const res = await fetchStudentByFace(faceidData);

                if (!alive) return;

                const student = res?.data;
                if (student?._id) {
                    selectedInmateIdRef.current = student._id;
                    setStudentSearchValue(student.inmateId || "");
                } else {
                    enqueueSnackbar(res?.message || "Student not found", { variant: "warning" });
                }
            } catch (err) {
                if (!alive) return;
                console.log(err);

                enqueueSnackbar(
                    err?.response?.data?.message || "Face ID fetch failed",
                    { variant: "error" }
                );
            } finally {
                if (!alive) return;

                // ✅ close modal + clear to prevent infinite effect triggers
                setFaceIdData(null);
                setOpenFaceId(false);

                // ✅ allow new scan next time
                fetchingFaceRef.current = false;
            }
        })();

        return () => {
            alive = false;
        };
    }, [faceidData]);

    const filteredPurchases = useMemo(() => {
        const s = purchaseSearch.trim().toLowerCase();
        if (!s) return purchases;

        return (purchases || []).filter((p) => {
            const reg = (p?.student_id?.registration_number || "").toLowerCase();
            const name = (p?.student_id?.student_name || "").toLowerCase();
            return reg.includes(s) || name.includes(s);
        });
    }, [purchases, purchaseSearch]);

    const handleReverse = async (purchaseId) => {
        try {
            await reverseMutation.mutateAsync({ id: purchaseId });
            enqueueSnackbar("Purchase reversed successfully", { variant: "success" });
        } catch (err) {
            enqueueSnackbar(err?.response?.data?.message || "Failed to reverse purchase", {
                variant: "error",
            });
        }
    };

    const handleRefreshPurchases = () => setRefetchKey((p) => p + 1);

    // =========================
    // Student Search (LEFT)
    // =========================
    const [studentSearchValue, setStudentSearchValue] = useState("");
    const debouncedStudentSearchValue = useDebounce(studentSearchValue, 400);

    // ✅ YOUR HOOK expects a STRING, not an object
    const {
        data: studentsDataRaw,
        isFetching: studentFetching,
        error: studentError,
    } = useStudentExactQuery(debouncedStudentSearchValue);

    // If API returns { success, data }, unwrap it.
    // If API returns student object directly, this still works.
    const studentsData = studentsDataRaw?.data ?? studentsDataRaw;
    const findSingleStudent = !!studentsData?.[0]?._id;


    // =========================
    // Cart State (LEFT)
    // =========================
    const [cartItems, setCartItems] = useState([]);

    const removeOneItemById = (id) => {
        setCartItems((prev) => {
            const idx = prev.findIndex((x) => x?._id === id);
            if (idx === -1) return prev;
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
        });
    };

    // Build products payload for /pos-shop-cart/create
    const productsPayload = useMemo(() => {
        const map = new Map();
        for (const item of cartItems) {
            if (!item?._id) continue;
            map.set(item._id, (map.get(item._id) || 0) + 1);
        }
        return Array.from(map.entries()).map(([productId, quantity]) => ({
            productId,
            quantity,
        }));
    }, [cartItems]);

    // =========================
    // Available Items (RIGHT)
    // =========================
    const { data: availableItemsData } = useTuckShopItemsQuery();
    const availableItems = availableItemsData?.data || availableItemsData || [];

    // =========================
    // Create Purchase (LEFT button)
    // =========================
    const createCartMutation = useCreatePosCartMutation();

    const postCartData = async (values) => {
        try {
            await createCartMutation.mutateAsync(values);
            enqueueSnackbar("Purchase processed successfully", { variant: "success" });
            setCartItems([]);
        } catch (err) {
            enqueueSnackbar(err?.response?.data?.message || "Purchase failed", {
                variant: "error",
            });
        }
    };

    return (
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
            <Typography variant="h5" fontWeight={700}>
                Canteen POS System
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Process inmate purchases and manage inventory
            </Typography>

            {/* =========================
      RECENT PURCHASES (TOP)
  ========================== */}
            <Paper
                variant="outlined"
                sx={{
                    borderColor: "#3498db",
                    maxHeight: { xs: 260, sm: 220, md: 200 },
                    overflowY: "auto",
                    p: { xs: 1.5, sm: 2 },
                    mb: 2,
                }}
            >
                {/* Header row becomes column on mobile */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                        gap: 1,
                        flexDirection: { xs: "column", sm: "row" },
                    }}
                >
                    <Typography variant="h6" fontWeight={700}>
                        Recent Purchases
                    </Typography>

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            flexDirection: { xs: "column", sm: "row" },
                            width: { xs: "100%", sm: "auto" },
                        }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search by inmate ID..."
                            value={purchaseSearch}
                            onChange={(e) => setPurchaseSearch(e.target.value)}
                            sx={{ width: { xs: "100%", sm: 260 } }}
                        />

                        <Button
                            variant="outlined"
                            onClick={handleRefreshPurchases}
                            disabled={purchasesFetching}
                            startIcon={<Search size={16} />}
                            sx={{ width: { xs: "100%", sm: "auto" } }}
                        >
                            {purchasesFetching ? "Refreshing..." : "Refresh"}
                        </Button>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {purchasesLoading ? (
                    <Typography align="center" color="text.secondary" sx={{ py: 2 }}>
                        Loading purchases...
                    </Typography>
                ) : null}

                {!purchasesLoading && purchasesError && filteredPurchases.length === 0 ? (
                    <Typography color="error">
                        Error loading purchases:{" "}
                        {purchasesError?.message || purchasesError?.response?.data?.message}
                    </Typography>
                ) : null}

                {!purchasesLoading && filteredPurchases.length > 0 ? (
                    filteredPurchases.map((p) => (
                        <Box
                            key={p._id}
                            sx={{
                                py: 1,
                                display: "flex",
                                alignItems: { xs: "flex-start", md: "center" },
                                justifyContent: "space-between",
                                gap: 2,
                                flexDirection: { xs: "column", md: "row" },
                                borderBottom: "1px solid #e5e7eb",
                            }}
                        >
                            {/* LEFT INFO */}
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: { xs: "flex-start", sm: "center" },
                                    gap: 1.5,
                                    flexWrap: "wrap",
                                    width: "100%",
                                    overflow: "hidden",
                                }}
                            >
                                <Typography fontWeight={700} sx={{ minWidth: 0 }}>
                                    <span className="text-gray-500">Inmate:</span>{" "}
                                    {p.inmateId}
                                </Typography>

                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                        width: { xs: "100%", sm: "auto" },
                                        maxWidth: { sm: 380, md: 350 },
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: { xs: "normal", sm: "nowrap" },
                                    }}
                                >
                                    {(p.products || [])
                                        .map(
                                            (prod) =>
                                                `${prod.productId?.itemName || "Item"} x${prod.quantity}`
                                        )
                                        .join(", ")}
                                </Typography>

                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ minWidth: { xs: "auto", md: 160 } }}
                                >
                                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
                                </Typography>
                            </Box>

                            {/* RIGHT ACTIONS */}
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    justifyContent: { xs: "space-between", md: "flex-end" },
                                    width: { xs: "100%", md: "auto" },
                                }}
                            >
                                <Typography
                                    fontWeight={800}
                                    sx={{
                                        color: p.totalAmount < 0 ? "error.main" : "success.main",
                                        minWidth: 70,
                                        textAlign: "right",
                                    }}
                                >
                                    ₹{p.totalAmount}
                                </Typography>

                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    onClick={() => handleReverse(p._id)}
                                    disabled={p.is_reversed || reverseMutation.isPending}
                                    sx={{ width: { xs: "100%", sm: "auto" } }}
                                >
                                    {reverseMutation.isPending ? "Reversing..." : "Reverse"}
                                </Button>
                            </Box>
                        </Box>
                    ))
                ) : !purchasesLoading ? (
                    <Typography align="center" color="text.secondary" sx={{ py: 2 }}>
                        No purchases found for the searched student
                    </Typography>
                ) : null}
            </Paper>

            {/* =========================
      GRID: LEFT + RIGHT (responsive)
      xs=12 => full width on mobile
      md=6  => two columns on desktop
  ========================== */}
            {/* <Grid container spacing={2} sx={{ width: "100%" }} alignItems="stretch"> */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* LEFT */}
                <div>
                    <PosLeftCard
                        studentSearchValue={studentSearchValue}
                        setStudentSearchValue={setStudentSearchValue}
                        findSingleStudent={findSingleStudent}
                        studentsData={studentsData?.[0]}
                        cartItems={cartItems}
                        setCartItems={setCartItems}
                        removeOneItemById={removeOneItemById}
                        productsPayload={productsPayload}
                        onProcessPurchase={(valuesFromLeftCard) => postCartData(valuesFromLeftCard)}
                        setOpenFaceId={setOpenFaceId}
                    />

                    {studentFetching ? (
                        <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                            Searching student...
                        </Typography>
                    ) : null}

                    {studentError ? (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                            {studentError?.response?.data?.message ||
                                studentError?.message ||
                                "Student fetch failed"}
                        </Typography>
                    ) : null}
                </div>

                {/* RIGHT */}
                <div>
                    <Paper variant="outlined" sx={{ borderColor: "#3498db", p: { xs: 1.5, sm: 2 } }}>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                            Available Items
                        </Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 380, overflowY: "auto" }}>
                            {availableItems?.length ? (
                                availableItems.map((item) => (
                                    <Box
                                        key={item._id}
                                        onClick={() => setCartItems((prev) => [...prev, item])}
                                        sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 2,
                                            p: 1.5,
                                            borderRadius: 2,
                                            cursor: "pointer",
                                            border: "1px solid #3498db",
                                            "&:hover": { backgroundColor: "#f9fafb" },
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography fontWeight={600} noWrap>
                                                {item.itemName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" noWrap>
                                                Stock: {item.stockQuantity}
                                            </Typography>
                                        </Box>

                                        <Typography fontWeight={600} sx={{ flexShrink: 0 }}>
                                            ₹{item.price}
                                        </Typography>
                                    </Box>
                                ))
                            ) : (
                                <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                                    No items available
                                </Typography>
                            )}
                        </Box>
                    </Paper>
                </div>
            {/* </Grid> */}
            </div>

            {openFaceId && (
                <FaceRecognition
                    mode="match"
                    open={openFaceId}
                    setOpen={setOpenFaceId}
                    setFaceIdData={setFaceIdData}
                />
            )}
        </Box>
    );
};

export default CanteenPosSystem;
