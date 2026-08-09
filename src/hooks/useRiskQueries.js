import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFlaggedTransactions,
  getOfficerFeedbackHistory,
  submitOfficerFeedback,
} from "../service/riskService";

// Financial Anomaly & Fraud Detection

export const useFlaggedTransactionsQuery = ({ days = 7, limit = 5 } = {}) =>
  useQuery({
    queryKey: ["flagged-transactions", days, limit],
    queryFn: () => getFlaggedTransactions({ days, limit }),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

export const useOfficerFeedbackHistoryQuery = (transactionId) =>
  useQuery({
    queryKey: ["officer-feedback", transactionId],
    queryFn: () => getOfficerFeedbackHistory(transactionId),
    enabled: Boolean(transactionId),
    staleTime: 1000 * 10,
  });

export const useOfficerFeedbackMutation = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: submitOfficerFeedback,
    onSuccess: (_data, variables) => {
      // Refresh this transaction's review history and any flagged lists
      // that might now want to reflect the new review.
      qc.invalidateQueries({ queryKey: ["officer-feedback", variables?.transactionId] });
      qc.invalidateQueries({ queryKey: ["flagged-transactions"] });
    },
  });
};
