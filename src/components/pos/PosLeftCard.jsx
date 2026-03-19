import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
} from "@mui/material";
import { Camera, CreditCard } from "lucide-react";

const PosLeftCard = ({
  // student search
  studentSearchValue,
  setStudentSearchValue,
  findSingleStudent,
  studentsData,

  // cart
  cartItems,
  setCartItems,
  removeOneItemById,

  // checkout
  productsPayload,
  onProcessPurchase, // async (values) => void
  setOpenFaceId
}) => {
  // Build unique cart items with count
  const uniqueCartItems = useMemo(() => {
    const map = new Map();
    for (const item of cartItems || []) {
      if (!item?._id) continue;
      const prev = map.get(item._id);
      if (prev) map.set(item._id, { ...prev, count: prev.count + 1 });
      else map.set(item._id, { ...item, count: 1 });
    }
    return Array.from(map.values());
  }, [cartItems]);

  const total = useMemo(() => {
    return uniqueCartItems.reduce(
      (sum, item) => sum + Number(item?.price || 0) * Number(item?.count || 0),
      0
    );
  }, [uniqueCartItems]);

  const canCheckout =
    Number(studentsData?.balance || 0) >= total && total > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: "#3498db",
        p: 2,
      }}
    >
      <div className="flex flex-col md:flex-row justify-between items-center" >
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Point of Sale Terminal
        </Typography>
        <Button onClick={() => setOpenFaceId(true)} className="bg-gray-500! text-white!">
          <Camera className="mr-2 h-4 w-4" /> Verify Face ID
        </Button>
      </div>

      {/* Student */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Inmate
        </Typography>

        <TextField
          size="small"
          fullWidth
          placeholder="Search inmate by ID"
          value={studentSearchValue}
          onChange={(e) => setStudentSearchValue(e.target.value)}
        />

        {findSingleStudent && studentsData ? (
          <Box
            sx={{ mt: 1 }}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
          >
            <Typography variant="body2">
              Inmate Name: <strong>{studentsData?.firstName} {studentsData?.lastName}</strong> <span>{studentsData?.custodyType ?? +" " +studentsData?.custodyType}</span>
            </Typography>

            <Typography variant="body2">
              Balance:{" "}
              <span className="text-green-500 font-semibold">
                ₹{studentsData?.balance}
              </span>
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Cart */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Cart
        </Typography>

        <Box
          sx={{
            border: "1px solid #3498db",
            borderRadius: 2,
            p: 2,
            minHeight: 120,
            bgcolor: "#f9fafb",
          }}
        >
          {uniqueCartItems.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              Cart is empty
            </Typography>
          ) : (
            uniqueCartItems.map((item) => {
              const count = item.count || 0;
              const stock = Number(item.stockQuantity ?? Infinity);

              return (
                <Box
                  key={item._id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    bgcolor: "white",
                    p: 1,
                    borderRadius: 2,
                    mb: 1,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Box>
                    <Typography fontWeight={700}>
                      {item?.itemName}{" "}
                      <Typography component="span" color="text.secondary">
                        x{count}
                      </Typography>
                    </Typography>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => removeOneItemById(item._id)}
                    >
                      -
                    </Button>

                    <Typography fontWeight={800}>
                      ₹{(Number(item.price || 0) * count).toFixed(2)}
                    </Typography>

                    <Button
                      size="small"
                      variant="outlined"
                      disabled={count >= stock}
                      onClick={() => setCartItems((prev) => [...prev, item])}
                    >
                      +
                    </Button>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {/* Total + Checkout */}
      <Divider sx={{ my: 2 }} />

      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={800}>
          Total:
        </Typography>
        <Typography variant="h6" fontWeight={900} sx={{ color: "success.main" }}>
          ₹{total.toFixed(2)}
        </Typography>
      </Box>

      <Button
        fullWidth
        variant="contained"
        sx={{
          bgcolor: "#22c55e",
          "&:hover": { bgcolor: "#16a34a" },
          py: 1.2,
          textTransform: "none",
          fontWeight: 800,
        }}
        disabled={!canCheckout}
        startIcon={<CreditCard size={18} />}
        onClick={() => {
          const values = {
            inmateId: studentsData?.inmateId,
            totalAmount: total,
            products: productsPayload,
          };
          onProcessPurchase?.(values);
        }}
      >
        Process Purchase
      </Button>
    </Paper>
  );
};

export default PosLeftCard;
