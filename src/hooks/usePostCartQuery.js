import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPosShopCart, getPostCart, getTuckShopItems, reversePostCart } from "../service/posShopCartService";

/** GET: pos-shop-cart */
export const usePostCartQuery = ({ page, limit, search, refetchKey } = {}) =>
  useQuery({
    queryKey: ["pos-shop-cart", page, limit, search, refetchKey],
    queryFn: () => getPostCart({ page, limit, search }),
    placeholderData: (prev) => prev, // keeps list stable like your users table
    staleTime: 1000 * 10,
    refetchOnWindowFocus: false,
  });

/** POST: reverse pos-shop-cart */
export const useReversePostCartMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => reversePostCart({ id }),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-shop-cart"] });
      qc.invalidateQueries({ queryKey: ["studentExact"] });
    },
  });
};

export const useTuckShopItemsQuery = ({ refetchKey } = {}) =>
  useQuery({
    queryKey: ["tuck-shop", refetchKey],
    queryFn: getTuckShopItems,
    staleTime: 1000 * 10,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

/** CREATE PURCHASE MUTATION */
export const useCreatePosCartMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createPosShopCart(payload),
    onSuccess: () => {
      // refresh items stock + recent purchases + student balance
      qc.invalidateQueries({ queryKey: ["tuck-shop"] });
      qc.invalidateQueries({ queryKey: ["pos-shop-cart"] });
      qc.invalidateQueries({ queryKey: ["studentExact"] });
    },
  });
};