import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../service/transactionService";

export const useTransactionsQuery = ({ range, page, limit, search = "" }) =>
  useQuery({
    queryKey: ["transactions", range, page, limit, search],
    queryFn: () => getTransactions({ range, page, limit, search }),
    placeholderData: (prev) => prev, // ✅ keeps pagination stable (no jump)
    staleTime: 1000 * 10,
    refetchOnWindowFocus: false,
  });
