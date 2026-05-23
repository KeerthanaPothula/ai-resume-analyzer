import axios, { AxiosRequestConfig } from "axios";

// Dev: requests go to localhost:5173/api/v1/... and Vite proxy forwards to localhost:8000
// Prod: set VITE_API_URL=https://api.yoursite.com (no trailing slash)
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor — attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Token-refresh machinery ────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

// ── Response interceptor — silent refresh on 401 ──────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // If another refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((newToken) => {
          if (newToken) {
            original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
            resolve(api(original));
          } else {
            reject(error);
          }
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    const storedRefresh = localStorage.getItem("refresh_token");
    if (!storedRefresh) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    try {
      const res = await api.post("/auth/refresh", { refresh_token: storedRefresh });
      const { access_token, refresh_token: newRefresh } = res.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("refresh_token", newRefresh);

      drainQueue(access_token);
      original.headers = { ...original.headers, Authorization: `Bearer ${access_token}` };
      return api(original);
    } catch {
      drainQueue(null);
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; full_name: string; password: string; role: string }) =>
    api.post("/auth/register", data),

  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get("/auth/me"),
};

// ── Resumes ───────────────────────────────────────────────────────────────────
export const resumeApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/resumes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  list: () => api.get("/resumes/"),
  get: (id: number) => api.get(`/resumes/${id}`),
  delete: (id: number) => api.delete(`/resumes/${id}`),
};

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobApi = {
  create: (data: unknown) => api.post("/jobs/", data),
  list: () => api.get("/jobs/"),
  get: (id: number) => api.get(`/jobs/${id}`),
  delete: (id: number) => api.delete(`/jobs/${id}`),
};

// ── Analysis ──────────────────────────────────────────────────────────────────
export const analysisApi = {
  score: (resumeId: number, jobId: number) =>
    api.post(`/analysis/score/${resumeId}/${jobId}`),
  getResumeScores: (resumeId: number) =>
    api.get(`/analysis/scores/resume/${resumeId}`),
  getJobScores: (jobId: number) =>
    api.get(`/analysis/scores/job/${jobId}`),
};

// ── Rankings ──────────────────────────────────────────────────────────────────
export const rankingApi = {
  rank: (jobId: number, resumeIds: number[]) =>
    api.post(`/rankings/rank/${jobId}`, resumeIds),
  getForJob: (jobId: number) => api.get(`/rankings/job/${jobId}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  candidate: () => api.get("/dashboard/candidate"),
  recruiter: () => api.get("/dashboard/recruiter"),
};

// ── AI Feedback ───────────────────────────────────────────────────────────────
export const aiFeedbackApi = {
  status: () => api.get("/ai-feedback/status"),
  resumeFeedback: (resumeId: number) =>
    api.post(`/ai-feedback/resume/${resumeId}`),
  jobMatchFeedback: (resumeId: number, jobId: number) =>
    api.post(`/ai-feedback/resume/${resumeId}/job/${jobId}`),
  quickMatch: (resumeId: number, jobTitle: string, jobDescription: string) =>
    api.post("/ai-feedback/quick-match", { resume_id: resumeId, job_title: jobTitle, job_description: jobDescription }),
  chat: (message: string, resumeId?: number) =>
    api.post("/ai-feedback/chat", { message, resume_id: resumeId }),
};

// ── Profile / Account ─────────────────────────────────────────────────────────
export const profileApi = {
  update: (data: { full_name?: string; email?: string }) =>
    api.put("/users/me", data),
  updateMe: (userId: number, data: { full_name?: string; email?: string }) =>
    api.put(`/users/${userId}`, data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/auth/change-password", data),
};