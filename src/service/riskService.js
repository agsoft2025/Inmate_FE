import api from "../lib/axios";

// Financial Anomaly & Fraud Detection

export const getFlaggedTransactions = async ({ days = 7, limit = 5 } = {}) => {
  const res = await api.get("transactions/flagged", { params: { days, limit } });
  return res.data; // { success, days, flagged: [...] }
};

export const submitOfficerFeedback = async (payload) => {
  const res = await api.post("officer-feedback", payload);
  return res.data; // { success, data }
};

export const getOfficerFeedbackHistory = async (transactionId) => {
  const res = await api.get(`officer-feedback/${transactionId}`);
  return res.data; // { success, data: [...] }
};
