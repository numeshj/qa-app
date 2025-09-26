import axios from "axios";

// Backend currently mounts routes at root (e.g. /auth, /projects). Remove /api suffix here.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: false
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      // try refresh
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const res = await axios.post(
            (import.meta.env.VITE_API_URL || "http://localhost:4000") + "/auth/refresh",
            { refreshToken }
          );
          localStorage.setItem("accessToken", res.data.data.accessToken);
          error.config.headers["Authorization"] = `Bearer ${res.data.data.accessToken}`;
          return api.request(error.config);
        }
      } catch (_) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
