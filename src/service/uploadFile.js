import axios from "axios";
import { getCookie } from "../utils/cookieUtils";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Note: like every other authenticated call in this app, auth now rides
// along as an httpOnly cookie (withCredentials) instead of a manually
// attached Authorization header read from localStorage - see lib/axios.js
// for the shared client this same pattern is normally used through. This
// file makes its own raw axios call rather than using that shared client
// (pre-existing, not changed here), so it needs `withCredentials` and the
// CSRF header applied directly.
export const uploadFileApi = async (payload, id) => {
  const url = id ? `${BASE_URL}upload/${id}` : `${BASE_URL}upload`;
  const method = id ? "put" : "post";
  const csrfToken = getCookie("csrfToken");

  try {
    const response = await axios({
      method,
      url,
      data: payload,
      withCredentials: true,
      headers: {
        "Content-Type": "multipart/form-data",
        "ngrok-skip-browser-warning": "true",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });

    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.response?.data || error.message };
  }
};