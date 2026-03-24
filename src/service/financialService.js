import api from "../lib/axios";

export const createDeposit = async (payload) => {
  const res = await api.post("financial/create", payload);
  return res.data;
};
