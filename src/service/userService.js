import api from "../lib/axios";

export const getUsers = async ({ page = 1, limit = 10 }) => {
  const res = await api.get("users", {
    params: {
      page,
      limit,
    },
  });

  return res.data;
};


export const createUser = async (payload) => {
  const res = await api.post("users/create", payload);
  return res.data;
};

export const updateUser = async ({ id, payload }) => {
  const res = await api.put(`users/${id}`, payload);
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await api.delete(`users/${userId}`);
  return res.data;
};

export const deleteFaceRecognition = async (id) => {
  if (!id) throw new Error("Face ID is required");

  const res = await api.delete(`faceRecognition/delete/${id}`);

  return res.data; // { success, message }
};

export const getUserById = async (id) => {
  if (!id) throw new Error("User ID is required");

  const res = await api.get(`users/${id}`);

  return res.data;
};