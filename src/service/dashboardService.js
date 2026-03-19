import api from "../lib/axios";

export const getDashboard = async () => {
  const res = await api.get("dashboard");
  return res.data; // { success, data: {...} }
};
