import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, Users, BarChart3, Trash2, ChevronRight,
  MapPin, Clock, Search, Filter, Star, Target, TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import StatsCard from "../components/ui/StatsCard";
import SkillBadge from "../components/ui/SkillBadge";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonStatsRow, SkeletonCard } from "../components/ui/Skeleton";
import ErrorBoundary from "../components/error/ErrorBoundary";
import { dashboardApi, jobApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../stores/themeStore";

interface JobRow {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  required_skills: string[];
  experience_required: number;
  created_at: string;
  description: string | null;
}

interface RecruiterData {
  total_jobs: number;
  total_candidates: number;
  jobs_this_month: number;
  jobs: JobRow[];
}

function JobCard({
  job,
  onDelete,
}: {
  job: JobRow;
  onDelete: (id: number) => void;
}) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card p-4 hover:shadow-md transition-all duration-200 ${
        isDark ? "hover:border-violet-500/30" : "hover:border-violet-300"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5 text-violet-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="font-medium text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {job.title}
              </p>
              <div
                className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {job.company && <span>{job.company}</span>}
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                )}
                {job.experience_required > 0 && (
                  <span>{job.experience_required}+ yrs</span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <p
              className="text-xs mt-2 line-clamp-2 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {job.description}
            </p>
          )}

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mt-2">
            {job.required_skills.slice(0, 5).map((s) => (
              <SkillBadge key={s} skill={s} />
            ))}
            {job.required_skills.length > 5 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: "var(--text-muted)",
                  backgroundColor: "var(--border-color)",
                }}
              >
                +{job.required_skills.length - 5}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Link
              to={`/ranking/${job.id}`}
              className="btn-ghost text-xs px-2 py-1 gap-1.5"
            >
              <Star className="w-3.5 h-3.5" /> Rank Candidates
            </Link>
            <button
              onClick={() => onDelete(job.id)}
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

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery<RecruiterData>({
    queryKey: ["dashboard", "recruiter"],
    queryFn: () => dashboardApi.recruiter().then((r) => r.data),
  });

  const handleDelete = async (id: number) => {
    try {
      await jobApi.delete(id);
      toast.success("Job deleted");
      refetch();
    } catch {
      toast.error("Failed to delete job");
    }
  };

  const filteredJobs = data
    ? data.jobs.filter((j) => {
        const q = search.toLowerCase();
        return (
          j.title.toLowerCase().includes(q) ||
          (j.company ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          j.required_skills.some((s) => s.toLowerCase().includes(q))
        );
      })
    : [];

  if (error) {
    return (
      <Layout title="Dashboard">
        <div className="p-6 max-w-7xl mx-auto">
          <ErrorBoundary>
            <EmptyState
              icon={Briefcase}
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
    <Layout title="Recruiter Dashboard">
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
              Manage your job postings and find the best candidates
            </p>
          </div>
          <Link to="/jobs/create" className="btn-primary text-sm self-start sm:self-auto">
            <Plus className="w-4 h-4" /> Post a Job
          </Link>
        </div>

        {/* ── Stats row ── */}
        {isLoading ? (
          <SkeletonStatsRow />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatsCard
              title="Active Jobs"
              value={data!.total_jobs}
              icon={Briefcase}
              color="violet"
              delay={0}
            />
            <StatsCard
              title="Total Candidates"
              value={data!.total_candidates}
              icon={Users}
              color="sky"
              delay={0.05}
            />
            <StatsCard
              title="Jobs This Month"
              value={data!.jobs_this_month}
              icon={TrendingUp}
              color="emerald"
              delay={0.1}
            />
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LEFT — job pipeline (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                Job Pipeline
              </h3>
              <Link
                to="/jobs/create"
                className="flex items-center gap-1 text-xs font-medium text-violet-500 hover:text-violet-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add new
              </Link>
            </div>

            {/* Search bar */}
            {!isLoading && data!.jobs.length > 0 && (
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search jobs, companies, skills…"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} lines={2} />
                ))}
              </div>
            ) : data!.jobs.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Briefcase}
                  title="No jobs posted yet"
                  description="Post your first job and start ranking candidates with AI-powered matching."
                  action={{ label: "Post a Job", onClick: () => navigate("/jobs/create") }}
                />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description={`No jobs match "${search}". Try a different search term.`}
                  action={{ label: "Clear search", onClick: () => setSearch("") }}
                />
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {filteredJobs.map((j) => (
                    <JobCard key={j.id} job={j} onDelete={handleDelete} />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* RIGHT — sidebar panels (1/3) */}
          <div className="space-y-4">

            {/* Pipeline summary */}
            <div className="card p-5">
              <h3
                className="font-semibold text-sm mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                Pipeline Summary
              </h3>
              <div className="space-y-3">
                {[
                  {
                    label: "Open Positions",
                    value: isLoading ? "—" : data!.total_jobs,
                    color: "text-violet-500",
                    bg: "bg-violet-500/10",
                  },
                  {
                    label: "Candidate Pool",
                    value: isLoading ? "—" : data!.total_candidates,
                    color: "text-sky-500",
                    bg: "bg-sky-500/10",
                  },
                  {
                    label: "New This Month",
                    value: isLoading ? "—" : data!.jobs_this_month,
                    color: "text-emerald-500",
                    bg: "bg-emerald-500/10",
                  },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {label}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top required skills */}
            {!isLoading && data!.jobs.length > 0 && (() => {
              const skillCounts: Record<string, number> = {};
              data!.jobs.forEach((j) =>
                j.required_skills.forEach((s) => {
                  skillCounts[s] = (skillCounts[s] || 0) + 1;
                })
              );
              const topSkills = Object.entries(skillCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([skill]) => skill);

              return topSkills.length > 0 ? (
                <div className="card p-5">
                  <h3
                    className="font-semibold text-sm mb-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Most Sought Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {topSkills.map((skill) => (
                      <SkillBadge key={skill} skill={skill} />
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

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
                  label: "Post a new job",
                  icon: Plus,
                  path: "/jobs/create",
                  desc: "Create job posting",
                },
                {
                  label: "View rankings",
                  icon: Target,
                  path:
                    data && data.jobs.length > 0
                      ? `/ranking/${data.jobs[0].id}`
                      : "/jobs/create",
                  desc: "AI candidate matching",
                },
                {
                  label: "Analytics",
                  icon: BarChart3,
                  path: "/admin",
                  desc: "Platform insights",
                },
              ].map(({ label, icon: Icon, path, desc }) => (
                <Link
                  key={label}
                  to={path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 group ${
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-violet-500" />
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
