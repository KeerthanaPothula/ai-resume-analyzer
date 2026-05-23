import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { queryClient } from "./lib/queryClient";
import { useThemeStore, applyTheme } from "./stores/themeStore";

// Lazy-loaded pages — each route is a separate JS chunk
const Landing          = lazy(() => import("./pages/Landing"));
const Login            = lazy(() => import("./pages/Login"));
const Register         = lazy(() => import("./pages/Register"));
const CandidateDashboard = lazy(() => import("./pages/CandidateDashboard"));
const RecruiterDashboard = lazy(() => import("./pages/RecruiterDashboard"));
const ResumeUpload     = lazy(() => import("./pages/ResumeUpload"));
const ResumeAnalysis   = lazy(() => import("./pages/ResumeAnalysis"));
const CandidateRanking = lazy(() => import("./pages/CandidateRanking"));
const JobCreate        = lazy(() => import("./pages/JobCreate"));
const AdminDashboard   = lazy(() => import("./pages/AdminDashboard"));
const Profile          = lazy(() => import("./pages/Profile"));
const JobMatch         = lazy(() => import("./pages/JobMatch"));
const NotFound         = lazy(() => import("./pages/NotFound"));

// ChatAssistant is small and always-mounted — keep it eager
import ChatAssistant from "./components/ChatAssistant";

// Apply the persisted theme before first render
const { theme } = useThemeStore.getState();
applyTheme(theme);

function PageSpinner() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (user?.role === "recruiter") return <Navigate to="/recruiter" replace />;
  if (user?.role === "admin")     return <Navigate to="/admin"     replace />;
  return <Navigate to="/candidate" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardRedirect /></ProtectedRoute>
        } />

        <Route path="/candidate" element={
          <ProtectedRoute roles={["candidate", "admin"]}>
            <CandidateDashboard />
          </ProtectedRoute>
        } />

        <Route path="/recruiter" element={
          <ProtectedRoute roles={["recruiter", "admin"]}>
            <RecruiterDashboard />
          </ProtectedRoute>
        } />

        <Route path="/upload" element={
          <ProtectedRoute><ResumeUpload /></ProtectedRoute>
        } />

        <Route path="/analysis/:resumeId" element={
          <ProtectedRoute><ResumeAnalysis /></ProtectedRoute>
        } />

        <Route path="/ranking/:jobId" element={
          <ProtectedRoute roles={["recruiter", "admin"]}>
            <CandidateRanking />
          </ProtectedRoute>
        } />

        <Route path="/jobs/create" element={
          <ProtectedRoute roles={["recruiter", "admin"]}>
            <JobCreate />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />

        <Route path="/job-match" element={
          <ProtectedRoute roles={["candidate", "admin"]}>
            <JobMatch />
          </ProtectedRoute>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <ChatAssistant />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
