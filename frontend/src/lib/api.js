import { http } from "@/auth/AuthContext";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const listFields = () => http.get("/fields").then((r) => r.data);
export const createField = (name) => http.post("/fields", { name }).then((r) => r.data);
export const getField = (id) => http.get(`/fields/${id}`).then((r) => r.data);
export const updateField = (id, patch) => http.put(`/fields/${id}`, patch).then((r) => r.data);
export const deleteField = (id) => http.delete(`/fields/${id}`).then((r) => r.data);
export const duplicateField = (id) => http.post(`/fields/${id}/duplicate`).then((r) => r.data);

export const backupFields = () => http.get("/backup").then((r) => r.data);
export const restoreBackup = (payload) => http.post("/backup/restore", payload).then((r) => r.data);
export const claimGuestFields = () => http.post("/auth/claim-guest-fields").then((r) => r.data);
