import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const uploadFileApi = async (payload, id) => {
  const token = localStorage.getItem("token");
  const url = id ? `${BASE_URL}upload/${id}` : `${BASE_URL}upload`;
  const method = id ? "put" : "post";

  try {
    const response = await axios({
      method,
      url,
      data: payload,
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true"
      },
    });

    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.response?.data || error.message };
  }
};