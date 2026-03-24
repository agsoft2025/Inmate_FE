// src/service/reportService.js
import api from "../lib/axios";

/**
 * GET students (your current useFetchData was: useFetchData(`student`, ..., "true","true"))
 * Adjust params as per your API.
 */
export const getStudents = async () => {
  const res = await api.get("student", {
    params: { active: true, includeAll: true }, // change if needed
  });
  return res.data;
};

export const getDepartments = async () => {
  const res = await api.get("department");
  return res.data;
};

export const getQuickStatistics = async () => {
  const res = await api.get("reports/quick-statistics");
  return res.data;
};

/**
 * Generate report (POST)
 * Important: For CSV/string JSON normal response
 * For Excel we must request blob/arraybuffer.
 */
export const generateReport = async ({ url, payload, format }) => {
  // If excel, request blob so download works
  if (format === "excel") {
    const res = await api.post(url, payload, { responseType: "blob" });
    return res.data; // Blob
  }

  // CSV usually string
  // PDF usually JSON
  const res = await api.post(url, payload);
  return res.data;
};
