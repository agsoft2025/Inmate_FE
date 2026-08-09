import api from "../lib/axios";

export const getAuditLogs = async ({
  page = 1,
  limit = 10,
  search = "",
  fromDate = "",
  toDate = "",
  userId = "",
  action = "",
} = {}) => {
  const res = await api.get("logs", {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
    },
  });
  return res.data; // expecting something like { success, data, total, ... }
};
