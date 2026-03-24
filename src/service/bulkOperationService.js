import api from "../lib/axios";

export const uploadStudentsBulk = async ({ locationId, file }) => {
  const formData = new FormData();
  formData.append("location_id", locationId);
  formData.append("file", file);

  const res = await api.post("bulk-oprations/inmates", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const downloadSampleCsv = async ({ type, locationId }) => {
  const url =
    type === "inmate"
      ? `inmate/download-csv/${locationId}`
      : `financial/wages/download-csv/${locationId}`;

  const response = await api.get(url, {
    responseType: "blob", // 🔥 REQUIRED
  });

  return response.data; // Blob
};
