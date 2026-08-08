import api from "../lib/axios";

export const getTransactions = async ({ range = "daily", page = 1, limit = 10, search = "" } = {}) => {
  const res = await api.get("transactions", {
    params: {
      range,
      page,
      limit,
      ...(search ? { search } : {}),
    },
  });
  return res.data;
};
