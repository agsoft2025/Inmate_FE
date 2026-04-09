import api from "../lib/axios";

/**
 * LOGIN API
 * @param {{ username: string, password: string }} payload
 */
export const loginService = async (payload) => {
  const response = await api.post("user/login", payload);
  return response.data;
};

export const logoutService = async () => {
  const response = await api.post("user/logout");
  return response.data;
};
