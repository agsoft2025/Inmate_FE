import api from "../lib/axios";

export const getAuditLogs = async ({ page = 1, limit = 10, search = "" } = {}) => {
  const res = await api.get("logs", {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
    },
  });
  return res.data; // expecting something like { success, data, total, ... }
};
