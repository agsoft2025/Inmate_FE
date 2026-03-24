import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../service/transactionService";

export const useTransactionsQuery = ({ range, page, limit }) =>
  useQuery({
    queryKey: ["transactions", range, page, limit],
    queryFn: () => getTransactions({ range, page, limit }),
    placeholderData: (prev) => prev, // ✅ keeps pagination stable (no jump)
    staleTime: 1000 * 10,
    refetchOnWindowFocus: false,
  });
