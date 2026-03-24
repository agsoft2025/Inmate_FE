import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios";

export const getInventory = async ({ page, limit, search, startDate, endDate }) => {
  const params = new URLSearchParams();

  params.append("page", page);
  params.append("limit", limit);

  if (search) params.append("search", search);
  if (startDate && endDate) {
    params.append("startDate", startDate);
    params.append("endDate", endDate);
  }

  const res = await api.get(`/inventory?${params.toString()}`);
  return res.data; // could be { success, data, total, ... }
};

export const deleteInventory = async (id) => {
  const res = await api.delete(`/inventory/store/${id}`);
  return res.data;
};


// create canteen stock
const createCanteenStock = async (payload) => {
  const res = await api.post("/inventory/create-canteen-stock", payload);
  return res.data;
};

// transfer inventory (edit flow in your modal)
const transferCanteenStock = async (payload) => {
  const res = await api.post("/inventory/transfer", payload);
  return res.data;
};

export const useCreateCanteenStockMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createCanteenStock,
    onSuccess: () => {
      // adjust queryKey if your list uses something else
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["tuck-shop"] });
    },
  });
};

export const useTransferCanteenStockMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: transferCanteenStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["tuck-shop"] });
    },
  });
};