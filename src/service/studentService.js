import api from "../lib/axios";

export const searchStudentExact = async (query) => {
  const res = await api.get("inmate/search", { params: { query } });
  return res.data; // { success, data: [...] }
};

export const getStudents = async ({ search = "", page = 1, limit = 10 }) => {
  const res = await api.get("inmate", {
    params: { search, page, limit },
  });
  return res.data;
};

export const createStudent = async (data) => {
  const res = await api.post("inmate/create", data);
  return res.data;
};

export const updateStudent = async ({ id, data }) => {
  const res = await api.put(`inmate/${id}`, data);
  return res.data;
};

export const deleteStudent = async (studentId) => {
  const res = await api.delete(`inmate/${studentId}`);
  return res.data;
};

export async function getStudentProfile(registrationNumber) {
  if (!registrationNumber) throw new Error("registrationNumber is required");

  const res = await api.get(`inmate/inmateid/${registrationNumber}`);
  // Your API returns: { success, data, message }
  return res.data;
}

export async function getStudentTransactions(registrationNumber, page = 1, limit = 10) {
  if (!registrationNumber) throw new Error("registrationNumber is required");

  const res = await api.get(
    `inmate/inmate-transaction/${registrationNumber}`,
    { params: { page, limit } }
  );

  // returns:
  // { success, student, total, page, limit, totalPages, transactions }
  return res.data;
}

export async function fetchStudentByFace(descriptor) {
  const res = await api.post("inmate/fetch-by-face", { descriptor });
  return res.data; // { success, data, message }
}