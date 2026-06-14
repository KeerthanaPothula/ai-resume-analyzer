import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, TrendingUp, Award, Lightbulb, Star,
  ChevronRight, Trash2, Eye, Plus, Clock, Target,
  Briefcase, Calendar, Link2, Copy, CheckCircle2,
  XCircle, AlertCircle, Bell,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import Layout from "../components/layout/Layout";
import StatsCard from "../components/ui/StatsCard";
import SkillBadge from "../components/ui/SkillBadge";
import ScoreRing from "../components/ui/ScoreRing";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonStatsRow, SkeletonCard } from "../components/ui/Skeleton";
import ErrorBoundary from "../components/error/ErrorBoundary";
import { dashboardApi, resumeApi, rankingApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../stores/themeStore";
import {
  MyApplication, ApplicationStatus,
  APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_ORDER,
} from "../types";

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

// ── Application Status Badge ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const c = APPLICATION_STATUS_COLORS[status];
  const icons: Record<ApplicationStatus, React.ElementType> = {
    applied: Clock,
    under_review: AlertCircle,
    shortlisted: Star,
    interview_scheduled: Calendar,
    rejected: XCircle,
    accepted: CheckCircle2,
  };
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" />
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

// ── Application Status Timeline ────────────────────────────────────────────────

function ApplicationTimeline({ status }: { status: ApplicationStatus }) {
  const steps: ApplicationStatus[] = ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'accepted'];
  const isRejected = status === 'rejected';
  const currentIdx = isRejected ? -1 : steps.indexOf(status);

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-xs text-red-400 font-medium">Application not selected at this time</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1 min-w-0">
      {steps.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const c = APPLICATION_STATUS_COLORS[step];
        return (
          <div key={step} className="flex items-center min-w-0">
            <div className={`flex flex-col items-center gap-1 flex-shrink-0 ${isCurrent ? 'scale-110' : ''} transition-transform`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                isDone || isCurrent ? `${c.dot} border-current` : 'bg-transparent border-slate-300 dark:border-slate-600'
              }`}>
                {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className={`text-[9px] font-medium leading-tight text-center max-w-[48px] ${
                isCurrent ? c.text : isDone ? 'text-emerald-500' : ''
              }`}
              style={!isCurrent && !isDone ? { color: 'var(--text-muted)' } : {}}>
                {APPLICATION_STATUS_LABELS[step].split(' ').join('\n')}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-10 flex-shrink-0 mx-0.5 rounded ${i < currentIdx ? 'bg-emerald-500' : ''}`}
                style={i >= currentIdx ? { backgroundColor: 'var(--border-color)' } : {}} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Application Card ───────────────────────────────────────────────────────────

function ApplicationCard({ app }: { app: MyApplication }) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (app.meeting_link) {
      navigator.clipboard.writeText(app.meeting_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Meeting link copied!");
    }
  };

  const scoreColor =
    app.score >= 75 ? "text-emerald-500" : app.score >= 50 ? "text-amber-500" : "text-red-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card p-4 space-y-3 hover:shadow-md transition-all duration-200 ${
        isDark ? "hover:border-sky-500/30" : "hover:border-sky-300"
      }`}
    >
      {/* Job header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-4 h-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {app.job_title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[app.company, app.location].filter(Boolean).join(" · ")}
                {app.applied_at && (
                  <span className="ml-2">· Applied {new Date(app.applied_at).toLocaleDateString()}</span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <StatusBadge status={app.application_status} />
              <span className={`text-sm font-bold ${scoreColor}`}>
                {Math.round(app.score)}%
                <span className="text-xs font-normal ml-0.5 opacity-70">match</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <ApplicationTimeline status={app.application_status} />

      {/* Interview details */}
      {app.application_status === 'interview_scheduled' && app.interview_date && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 rounded-xl space-y-2 overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '3px solid #8b5cf6' }}
        >
          <p className="text-xs font-semibold text-violet-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Interview Details
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {new Date(app.interview_date).toLocaleString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
          {app.meeting_link && (
            <div className="flex items-center gap-2">
              <a
                href={app.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-violet-500 hover:underline"
              >
                <Link2 className="w-3 h-3" /> Join Meeting
              </a>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-400 transition-colors ml-2"
              >
                <Copy className="w-3 h-3" />
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}
          {app.interview_instructions && (
            <p className="text-xs italic leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {app.interview_instructions}
            </p>
          )}
        </motion.div>
      )}

      {/* Accepted message */}
      {app.application_status === 'accepted' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-500 font-medium">
            Congratulations! Your application has been accepted.
          </p>
        </div>
      )}

      {/* Recruiter notes (visible if meaningful) */}
      {app.recruiter_notes && app.application_status !== 'applied' && (
        <div className="p-2.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Recruiter note: </span>
          {app.recruiter_notes}
        </div>
      )}
    </motion.div>
  );
}

// ── Score Gauge ────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label =
    score >= 75 ? "Excellent" : score >= 50 ? "Good" : "Needs Work";
  return (
    <div className="flex flex-col items-center gap-1">
      <ScoreRing score={score} size={110} />
      <span className="text-xs font-medium mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Resume Card ────────────────────────────────────────────────────────────────

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
    resume.ats_score >= 75 ? "text-emerald-500"
    : resume.ats_score >= 50 ? "text-amber-500"
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
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {resume.original_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {resume.candidate_name && `${resume.candidate_name} · `}
                {resume.experience_years > 0 && `${resume.experience_years.toFixed(0)} yrs · `}
                {new Date(resume.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-lg font-bold flex-shrink-0 ${scoreColor}`}>
              {resume.ats_score.toFixed(0)}
              <span className="text-xs font-normal ml-0.5">%</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {resume.extracted_skills.slice(0, 5).map((s) => (
              <SkillBadge key={s} skill={s} />
            ))}
            {resume.extracted_skills.length > 5 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--border-color)" }}
              >
                +{resume.extracted_skills.length - 5}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Link to={`/analysis/${resume.id}`} className="btn-ghost text-xs px-2 py-1 gap-1.5">
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

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", "candidate"],
    queryFn: () => dashboardApi.candidate().then((r) => r.data),
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery<MyApplication[]>({
    queryKey: ["my-applications"],
    queryFn: () => rankingApi.myApplications().then((r) => r.data),
  });

  const { mutate: deleteResume } = useMutation({
    mutationFn: (id: number) => resumeApi.delete(id),
    onSuccess: () => {
      toast.success("Resume deleted");
      qc.invalidateQueries({ queryKey: ["dashboard", "candidate"] });
      qc.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: () => toast.error("Failed to delete resume"),
  });

  const radarData = data
    ? [
        { subject: "Skills",     A: Math.min(100, data.total_skills * 8) },
        { subject: "ATS Score",  A: data.avg_ats_score                   },
        { subject: "Resumes",    A: Math.min(100, data.total_resumes * 20) },
        { subject: "Best Score", A: data.best_ats_score                  },
      ]
    : [];

  // Notification indicator: any new status updates in last 24h
  const recentUpdates = applications.filter(a => {
    if (!a.updated_at) return false;
    const diff = Date.now() - new Date(a.updated_at).getTime();
    return diff < 86400000 && a.application_status !== 'applied';
  });

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
            <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Welcome back, {user?.full_name?.split(" ")[0]}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Here&apos;s your resume performance at a glance
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {recentUpdates.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                <Bell className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-xs font-medium text-sky-500">
                  {recentUpdates.length} update{recentUpdates.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            <Link to="/upload" className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Upload Resume
            </Link>
          </div>
        </div>

        {/* ── Stats row ── */}
        {isLoading ? (
          <SkeletonStatsRow />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Resumes"  value={data!.total_resumes}  icon={FileText}   color="sky"     delay={0}    />
            <StatsCard title="Avg ATS Score"  value={`${data!.avg_ats_score}%`} icon={TrendingUp} color="violet" delay={0.05} />
            <StatsCard title="Best Score"     value={`${data!.best_ats_score}%`} icon={Award}  color="emerald" delay={0.1}  />
            <StatsCard title="Skills Detected" value={data!.total_skills} icon={Star}        color="amber"   delay={0.15} />
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LEFT — resume list (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                Resume History
              </h3>
              <Link to="/upload" className="flex items-center gap-1 text-xs font-medium text-sky-500 hover:text-sky-400 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add new
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
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
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {data!.resumes.map((r) => (
                    <ResumeCard key={r.id} resume={r} onDelete={(id) => deleteResume(id)} />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* RIGHT — score + skills + suggestions + quick actions (1/3) */}
          <div className="space-y-4">

            {/* ATS Score ring */}
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>
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
                <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                  Profile Overview
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 11 }}
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
                <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                  Skills Detected
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {data!.top_skills.map((skill) => <SkillBadge key={skill} skill={skill} />)}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {!isLoading && data!.suggestions.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    AI Suggestions
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {data!.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick actions */}
            <div className="card p-5 space-y-2">
              <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                Quick Actions
              </h3>
              {[
                { label: "Upload new resume",    icon: Upload,   path: "/upload",    desc: "Add another version"       },
                {
                  label: "View latest analysis",
                  icon: Target,
                  path: data && data.resumes.length > 0 ? `/analysis/${data.resumes[0].id}` : "/upload",
                  desc: "See AI insights",
                },
                { label: "Job Match Analyzer",   icon: Clock,    path: "/job-match", desc: "Paste any job description" },
              ].map(({ label, icon: Icon, path, desc }) => (
                <Link
                  key={label}
                  to={path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 group ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Application Progress ── */}
        <div className="card p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                My Applications
              </h3>
              {applications.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-500">
                  {applications.length}
                </span>
              )}
            </div>
          </div>

          {appsLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map(i => <SkeletonCard key={i} lines={3} />)}
            </div>
          ) : applications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 px-6 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: "var(--border-color)" }}
              >
                <Briefcase className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                You have not applied to any jobs yet
              </h3>
              <p className="text-sm max-w-xs mb-6" style={{ color: "var(--text-muted)" }}>
                Match your resume against a job posting and a recruiter will review your application. Your status will appear here once reviewed.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button onClick={() => navigate("/job-match")} className="btn-primary text-sm">
                  <Target className="w-4 h-4" /> Browse Jobs
                </button>
                <button onClick={() => navigate("/upload")} className="btn-ghost text-sm">
                  <Upload className="w-4 h-4" /> Upload Resume
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {applications.map(app => (
                  <ApplicationCard key={app.ranking_id} app={app} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
