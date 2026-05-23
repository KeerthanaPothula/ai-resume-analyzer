import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText, Upload, TrendingUp, Award, Lightbulb, Star,
  ChevronRight, Trash2, Eye, Plus, Clock, Target,
} from "lucide-react";
import toast from "react-hot-toast";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import Layout from "../components/layout/Layout";
import StatsCard from "../components/ui/StatsCard";
import SkillBadge from "../components/ui/SkillBadge";
import ScoreRing from "../components/ui/ScoreRing";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonStatsRow, SkeletonCard, SkeletonTable } from "../components/ui/Skeleton";
import ErrorBoundary from "../components/error/ErrorBoundary";
import { dashboardApi, resumeApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../stores/themeStore";

interface ResumeRow {
  id: number;
  original_name: string;
  ats_score: number;
  extracted_skills: string[];
  candidate_name: string | null;
  experience_years: number;
  education_level: string | null;
  created_at: string;
  ai_feedback: string | null;
  strengths: string[];
  weaknesses: string[];
}

interface DashboardData {
  total_resumes: number;
  avg_ats_score: number;
  best_ats_score: number;
  total_skills: number;
  top_skills: string[];
  latest_resume_date: string | null;
  suggestions: string[];
  resumes: ResumeRow[];
}

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label =
    score >= 75 ? "Excellent" : score >= 50 ? "Good" : "Needs Work";
  return (
    <div className="flex flex-col items-center gap-1">
      <ScoreRing score={score} size={110} />
      <span className="text-xs font-medium mt-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function ResumeCard({
  resume,
  onDelete,
}: {
  resume: ResumeRow;
  onDelete: (id: number) => void;
}) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const scoreColor =
    resume.ats_score >= 75
      ? "text-emerald-500"
      : resume.ats_score >= 50
      ? "text-amber-500"
      : "text-red-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card p-4 hover:shadow-md transition-all duration-200 ${
        isDark ? "hover:border-sky-500/30" : "hover:border-sky-300"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-sky-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="font-medium text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {resume.original_name}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {resume.candidate_name && `${resume.candidate_name} · `}
                {resume.experience_years > 0 &&
                  `${resume.experience_years.toFixed(0)} yrs · `}
                {new Date(resume.created_at).toLocaleDateString()}
              </p>
            </div>
            {/* ATS score badge */}
            <span
              className={`text-lg font-bold flex-shrink-0 ${scoreColor}`}
            >
              {resume.ats_score.toFixed(0)}
              <span className="text-xs font-normal ml-0.5">%</span>
            </span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mt-2">
            {resume.extracted_skills.slice(0, 5).map((s) => (
              <SkillBadge key={s} skill={s} />
            ))}
            {resume.extracted_skills.length > 5 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: "var(--text-muted)",
                  backgroundColor: "var(--border-color)",
                }}
              >
                +{resume.extracted_skills.length - 5}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Link
              to={`/analysis/${resume.id}`}
              className="btn-ghost text-xs px-2 py-1 gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> View Analysis
            </Link>
            <button
              onClick={() => onDelete(resume.id)}
              className="btn-ghost text-xs px-2 py-1 gap-1.5 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", "candidate"],
    queryFn: () => dashboardApi.candidate().then((r) => r.data),
  });

  const handleDelete = async (id: number) => {
    try {
      await resumeApi.delete(id);
      toast.success("Resume deleted");
      refetch();
    } catch {
      toast.error("Failed to delete resume");
    }
  };

  const radarData = data
    ? [
        {
          subject: "Skills",
          A: Math.min(100, data.total_skills * 8),
        },
        {
          subject: "ATS Score",
          A: data.avg_ats_score,
        },
        {
          subject: "Resumes",
          A: Math.min(100, data.total_resumes * 20),
        },
        {
          subject: "Best Score",
          A: data.best_ats_score,
        },
      ]
    : [];

  if (error) {
    return (
      <Layout title="Dashboard">
        <div className="p-6 max-w-7xl mx-auto">
          <ErrorBoundary>
            <EmptyState
              icon={FileText}
              title="Failed to load dashboard"
              description="Could not connect to the server. Make sure the backend is running."
              action={{ label: "Retry", onClick: () => refetch() }}
            />
          </ErrorBoundary>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Candidate Dashboard">
      <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Welcome back, {user?.full_name?.split(" ")[0]} 👋
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Here&apos;s your resume performance at a glance
            </p>
          </div>
          <Link to="/upload" className="btn-primary text-sm self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Upload Resume
          </Link>
        </div>

        {/* ── Stats row ── */}
        {isLoading ? (
          <SkeletonStatsRow />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Resumes"
              value={data!.total_resumes}
              icon={FileText}
              color="sky"
              delay={0}
            />
            <StatsCard
              title="Avg ATS Score"
              value={`${data!.avg_ats_score}%`}
              icon={TrendingUp}
              color="violet"
              delay={0.05}
            />
            <StatsCard
              title="Best Score"
              value={`${data!.best_ats_score}%`}
              icon={Award}
              color="emerald"
              delay={0.1}
            />
            <StatsCard
              title="Skills Detected"
              value={data!.total_skills}
              icon={Star}
              color="amber"
              delay={0.15}
            />
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LEFT — resume list (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                Resume History
              </h3>
              <Link
                to="/upload"
                className="flex items-center gap-1 text-xs font-medium text-sky-500 hover:text-sky-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add new
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} lines={2} />
                ))}
              </div>
            ) : data!.resumes.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Upload}
                  title="No resumes yet"
                  description="Upload your first resume and our AI will parse it, extract skills, and calculate your ATS score."
                  action={{ label: "Upload Resume", onClick: () => navigate("/upload") }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {data!.resumes.map((r) => (
                  <ResumeCard key={r.id} resume={r} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — score + skills + suggestions (1/3) */}
          <div className="space-y-4">

            {/* ATS Score ring */}
            <div className="card p-5">
              <h3
                className="font-semibold text-sm mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Average ATS Score
              </h3>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-24 h-24 rounded-full skeleton" />
                </div>
              ) : (
                <div className="flex justify-center">
                  <ScoreGauge score={data!.avg_ats_score} />
                </div>
              )}
            </div>

            {/* Radar profile */}
            {!isLoading && data!.total_resumes > 0 && (
              <div className="card p-5">
                <h3
                  className="font-semibold text-sm mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Profile Overview
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid
                      stroke={isDark ? "#334155" : "#e2e8f0"}
                    />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{
                        fill: isDark ? "#94a3b8" : "#475569",
                        fontSize: 11,
                      }}
                    />
                    <Radar
                      name="Profile"
                      dataKey="A"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top skills */}
            {!isLoading && data!.top_skills.length > 0 && (
              <div className="card p-5">
                <h3
                  className="font-semibold text-sm mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Skills Detected
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data!.top_skills.map((skill) => (
                    <SkillBadge key={skill} skill={skill} />
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {!isLoading && data!.suggestions.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <h3
                    className="font-semibold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    AI Suggestions
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {data!.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {s}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick actions */}
            <div className="card p-5 space-y-2">
              <h3
                className="font-semibold text-sm mb-3"
                style={{ color: "var(--text-primary)" }}
              >
                Quick Actions
              </h3>
              {[
                {
                  label: "Upload new resume",
                  icon: Upload,
                  path: "/upload",
                  desc: "Add another version",
                },
                {
                  label: "View latest analysis",
                  icon: Target,
                  path:
                    data && data.resumes.length > 0
                      ? `/analysis/${data.resumes[0].id}`
                      : "/upload",
                  desc: "See AI insights",
                },
                {
                  label: "Job Match Analyzer",
                  icon: Clock,
                  path: "/job-match",
                  desc: "Paste any job description",
                },
              ].map(({ label, icon: Icon, path, desc }) => (
                <Link
                  key={label}
                  to={path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 group ${
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {desc}
                    </p>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ color: "var(--text-muted)" }}
                  />
                </Link>
              ))}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
