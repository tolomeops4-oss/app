import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const listFields = () => http.get("/fields").then((r) => r.data);
export const createField = (name) => http.post("/fields", { name }).then((r) => r.data);
export const getField = (id) => http.get(`/fields/${id}`).then((r) => r.data);
export const updateField = (id, patch) => http.put(`/fields/${id}`, patch).then((r) => r.data);
export const deleteField = (id) => http.delete(`/fields/${id}`).then((r) => r.data);
export const duplicateField = (id) => http.post(`/fields/${id}/duplicate`).then((r) => r.data);
