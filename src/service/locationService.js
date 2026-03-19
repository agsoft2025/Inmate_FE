import api from "../lib/axios";

// DB
export const saveBackupConfig = async (payload) => {
  const res = await api.post("backup", payload);
  return res.data;
};

// Get location
export const getLocations = async () => {
  const res = await api.get("location"); // GET /location
  return res.data; // your response: { success, data: [...], message }
};

/**
 * CREATE location
 */
export const createLocation = async (payload) => {
  const res = await api.post("location", payload);
  return res.data;
};

/**
 * UPDATE location
 */
export const updateLocation = async ({ id, payload }) => {
  const res = await api.put(`location/${id}`, payload);
  return res.data;
};
