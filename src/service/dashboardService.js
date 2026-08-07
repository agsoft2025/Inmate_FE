import api from "../lib/axios";

export const getDashboard = async () => {
  const res = await api.get("dashboard");
  return res.data; // { success, data: {...} }
};

// Predictive Low-Balance Outreach: staff must review/edit the drafted
// message and explicitly click "Send" before this is ever called.
export const sendLowBalanceOutreach = async ({ inmateId, message }) => {
  const res = await api.post("dashboard/outreach", { inmateId, message });
  return res.data;
};
