import api from "../lib/axios";

export const getAuditLogs = async ({ page = 1, limit = 10 }) => {
  const res = await api.get("logs", { params: { page, limit } });
  return res.data; // expecting something like { success, data, total, ... }
};
