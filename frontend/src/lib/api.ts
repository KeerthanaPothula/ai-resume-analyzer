import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

// Dev: Vite proxy forwards /api/v1/... to localhost:8000 (see vite.config.ts)
// Prod: VITE_API_URL must be set in Vercel Environment Variables (no trailing slash)
//       e.g. VITE_API_URL=https://recruitai-backend.onrender.com
const _rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

if (!_rawApiUrl && import.meta.env.PROD) {
  // This appears in the browser console — open DevTools → Console to see it
  console.error(
    "[RecruitAI] VITE_API_URL is not set. " +
      "All API calls will return the index.html page instead of JSON. " +
      "Fix: add VITE_API_URL=https://recruitai-backend-f6pi.onrender.com " +
      "in Vercel → Project Settings → Environment Variables, then redeploy."
  );
}

const API_BASE = _rawApiUrl ? `${_rawApiUrl}/api/v1` : "/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // 30 s — generous for AI endpoints that call Gemini
});

// ── Request interceptor — attach access token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── HTML response detector ─────────────────────────────────────────────────
// When VITE_API_URL is missing in production, Vercel's SPA rewrite returns
// index.html for every /api/v1/... call. Axios parses this as a 200 with an
// HTML body, which then crashes deep inside the app. We catch it early here.
function _detectHtmlResponse(response: AxiosResponse): AxiosResponse {
  const contentType = response.headers["content-type"] ?? "";
  if (
    typeof response.data === "string" &&
    response.data.trimStart().startsWith("<!") &&
    contentType.includes("text/html")
  ) {
    console.error(
      "[RecruitAI] API returned HTML instead of JSON. " +
        "This means VITE_API_URL is not set in Vercel environment variables. " +
        "Add VITE_API_URL=https://recruitai-backend-f6pi.onrender.com and redeploy."
    );
    throw Object.assign(new Error("API_URL_NOT_CONFIGURED"), {
      response: {
        status: 503,
        data: {
          detail:
            "Cannot reach the backend. If you are the site owner: add " +
            "VITE_API_URL=https://recruitai-backend-f6pi.onrender.com to Vercel " +
            "Environment Variables and redeploy.",
        },
      },
    });
  }
  return response;
}

// ── Token-refresh machinery ────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

// ── Response interceptor — HTML check + silent refresh on 401 ─────────────
api.interceptors.response.use(
  (res) => _detectHtmlResponse(res),
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

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post("/auth/reset-password", { token, new_password }),

  verifyEmail: (token: string) =>
    api.post("/auth/verify-email", { token }),

  resendVerification: (email: string) =>
    api.post("/auth/resend-verification", { email }),
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
  update: (id: number, data: unknown) => api.put(`/jobs/${id}`, data),
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
  myApplications: () => api.get('/rankings/my-applications'),
  updateEntry: (rankingId: number, data: {
    shortlisted?: boolean;
    notes?: string;
    application_status?: string;
    interview_date?: string | null;
    meeting_link?: string;
    interview_instructions?: string;
  }) => api.patch(`/rankings/${rankingId}`, data),
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

// ── Candidates (recruiter pool — one per unique user) ─────────────────────────
export const candidateApi = {
  list: () => api.get("/candidates/"),
};

// ── Applications (candidate self-apply) ───────────────────────────────────────
export const applicationApi = {
  apply: (jobId: number, resumeId: number) =>
    api.post("/applications/apply", { job_id: jobId, resume_id: resumeId }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get("/notifications/"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};
