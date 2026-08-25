import axios from "axios";
import { getCookie } from "../utils/cookieUtils";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // The JWT now lives in an httpOnly cookie set by the backend (see
  // AuthContext.jsx / authController.js's login) instead of localStorage -
  // withCredentials makes the browser send it (and receive Set-Cookie
  // updates) on every request to the API's origin.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const STATE_CHANGING_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * REQUEST INTERCEPTOR
 * The auth token itself is no longer read/attached here - it rides along
 * automatically as an httpOnly cookie. What IS still attached manually is
 * the CSRF double-submit token: a separate, non-httpOnly cookie set
 * alongside the auth cookie on login, echoed back as a custom header on
 * every state-changing request so the backend can tell the request was
 * made by this page's own JS (which can read the cookie) rather than
 * forged from another site (which can't) - see middleware/authToken.js on
 * the backend for the matching check.
 */
api.interceptors.request.use(
  (config) => {
    const method = (config.method || "get").toLowerCase();
    if (STATE_CHANGING_METHODS.has(method)) {
      const csrfToken = getCookie("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * RESPONSE INTERCEPTOR
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // optional auto logout - the auth cookie itself is cleared
      // server-side (or was never valid to begin with); only the cached
      // profile info needs clearing here.
      localStorage.removeItem("user");
      localStorage.clear();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
