import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteInventory, getInventory } from "../service/inventoryService";
import api from "../lib/axios";

export const useInventoryQuery = ({ page, limit, search, startDate, endDate, refetchKey }) =>
  useQuery({
    queryKey: ["inventory", page, limit, search, startDate, endDate, refetchKey],
    queryFn: () => getInventory({ page, limit, search, startDate, endDate }),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

export const useDeleteInventoryMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteInventory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};

// GET options: inventory/canteen-item-options
const getCanteenItemOptions = async () => {
  const res = await api.get("/inventory/canteen-item-options");
  return res.data;
};

// POST/PUT inventory
const upsertInventory = async ({ id, payload, isEdit }) => {
  const url = isEdit ? `/inventory/${id}` : `/inventory`;
  const method = isEdit ? "put" : "post";
  const res = await api[method](url, payload);
  return res.data;
};

// DELETE inventory item: inventory/item/:id
const deleteInventoryItem = async (id) => {
  const res = await api.delete(`/inventory/item/${id}`);
  return res.data;
};

export const useCanteenItemOptionsQuery = (enabled) =>
  useQuery({
    queryKey: ["inventory", "canteen-item-options"],
    queryFn: getCanteenItemOptions,
    enabled: !!enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

export const useUpsertInventoryMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: upsertInventory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory", "canteen-item-options"] });
    },
  });
};

export const useDeleteInventoryItemMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};

const transferInventory = async (payload) => {
  const res = await api.post("/inventory/transfer", payload);
  return res.data;
};

export const useTransferInventoryMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: transferInventory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["tuck-shop"] });
      qc.invalidateQueries({ queryKey: ["canteen-inventory"] });
    },
  });
};

// GET canteen inventory
const getCanteenInventory = async ({ page, limit, search }) => {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (search) params.append("search", search);

  const res = await api.get(`/inventory/canteen?${params.toString()}`);
  return res.data;
};

// DELETE canteen item
const deleteCanteenItem = async (idOrItemNo) => {
  // your earlier code: inventory/canteen-item/${id}
  const res = await api.delete(`/inventory/canteen-item/${idOrItemNo}`);
  return res.data;
};

export const useCanteenInventoryQuery = ({ page, limit, search }) =>
  useQuery({
    queryKey: ["canteen-inventory", page, limit, search],
    queryFn: () => getCanteenInventory({ page, limit, search }),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

export const useDeleteCanteenItemMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteCanteenItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canteen-inventory"] });
    },
  });
};