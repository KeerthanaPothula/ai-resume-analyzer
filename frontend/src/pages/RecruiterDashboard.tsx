import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, Users, BarChart3, Trash2, ChevronRight,
  MapPin, Clock, Search, Star, Target, TrendingUp, Edit2,
  X, Save, GraduationCap, Filter, ChevronDown,
  UserCheck, Zap, Eye, Award,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import Layout from "../components/layout/Layout";
import StatsCard from "../components/ui/StatsCard";
import SkillBadge from "../components/ui/SkillBadge";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonStatsRow, SkeletonCard } from "../components/ui/Skeleton";
import ErrorBoundary from "../components/error/ErrorBoundary";
import { dashboardApi, jobApi, resumeApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../stores/themeStore";
import { Resume } from "../types";

interface JobRow {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  required_skills: string[];
  experience_required: number;
  education_required?: string | null;
  created_at: string;
  description: string | null;
}

interface RecruiterData {
  total_jobs: number;
  total_candidates: number;
  jobs_this_month: number;
  jobs: JobRow[];
}

type Tab = "pipeline" | "candidates" | "analytics";

// ── Edit Job Modal ─────────────────────────────────────────────────────────────

function EditJobModal({
  job,
  onClose,
  onSave,
}: {
  job: JobRow;
  onClose: () => void;
  onSave: (id: number, data: Partial<JobRow>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: job.title,
    company: job.company || "",
    location: job.location || "",
    description: job.description || "",
    experience_required: job.experience_required,
    education_required: job.education_required || "",
    required_skills: job.required_skills.join(", "),
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(job.id, {
      ...form,
      required_skills: form.required_skills
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-violet-500/30 transition-all";
  const inputStyle = { backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Edit Job</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {(["title", "company", "location"] as const).map(field => (
            <div key={field}>
              <label className="text-xs font-medium capitalize mb-1 block" style={{ color: "var(--text-secondary)" }}>
                {field}{field === "title" ? " *" : ""}
              </label>
              <input
                type="text"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required={field === "title"}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Experience (years)</label>
              <input
                type="number"
                min={0}
                value={form.experience_required}
                onChange={e => setForm(f => ({ ...f, experience_required: parseFloat(e.target.value) || 0 }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Education</label>
              <select
                value={form.education_required}
                onChange={e => setForm(f => ({ ...f, education_required: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Any</option>
                <option value="High School">High School</option>
                <option value="Associate/Diploma">Associate / Diploma</option>
                <option value="Bachelor's">Bachelor's Degree</option>
                <option value="Master's">Master's Degree</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Required Skills (comma-separated)</label>
            <input
              type="text"
              value={form.required_skills}
              onChange={e => setForm(f => ({ ...f, required_skills: e.target.value }))}
              placeholder="React, TypeScript, Node.js"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={5}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Job Card ───────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onDelete,
  onEdit,
}: {
  job: JobRow;
  onDelete: (id: number) => void;
  onEdit: (job: JobRow) => void;
}) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card p-4 hover:shadow-md transition-all duration-200 ${isDark ? "hover:border-violet-500/30" : "hover:border-violet-300"}`}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {job.company && <span>{job.company}</span>}
              {job.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
              )}
              {job.experience_required > 0 && <span>{job.experience_required}+ yrs</span>}
              {job.education_required && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{job.education_required}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {job.description && (
            <p className="text-xs mt-2 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {job.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {job.required_skills.slice(0, 5).map(s => <SkillBadge key={s} skill={s} />)}
            {job.required_skills.length > 5 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)", backgroundColor: "var(--border-color)" }}>
                +{job.required_skills.length - 5}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Link to={`/ranking/${job.id}`} className="btn-ghost text-xs px-2 py-1 gap-1.5">
              <Star className="w-3.5 h-3.5" /> Rank Candidates
            </Link>
            <button onClick={() => onEdit(job)} className="btn-ghost text-xs px-2 py-1 gap-1.5">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
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

// ── Candidate Card ─────────────────────────────────────────────────────────────

function CandidateCard({ resume }: { resume: Resume }) {
  const score = resume.ats_score || 0;
  const scoreColor = score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {(resume.candidate_name || resume.original_name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                {resume.candidate_name || resume.original_name}
              </p>
              <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: "var(--text-muted)" }}>
                {resume.experience_years != null && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> {resume.experience_years.toFixed(0)}y
                  </span>
                )}
                {resume.education_level && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> {resume.education_level}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className={`text-lg font-bold ${scoreColor}`}>{Math.round(score)}%</span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>ATS</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(resume.extracted_skills || []).slice(0, 4).map(s => <SkillBadge key={s} skill={s} />)}
            {(resume.extracted_skills || []).length > 4 && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)", backgroundColor: "var(--border-color)" }}>
                +{resume.extracted_skills.length - 4}
              </span>
            )}
          </div>
        </div>
      </div>
      <Link
        to={`/analysis/${resume.id}`}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-500"
        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
      >
        <Eye className="w-3.5 h-3.5" /> View Full Analysis
      </Link>
    </motion.div>
  );
}

// ── Analytics Panel ────────────────────────────────────────────────────────────

function AnalyticsPanel({ jobs, resumes, isDark }: { jobs: JobRow[]; resumes: Resume[]; isDark: boolean }) {
  const tickColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";
  const tooltipStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: 12,
  };

  const monthlyJobs = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach(j => {
      const d = new Date(j.created_at);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).slice(-6).map(([name, count]) => ({ name, count }));
  }, [jobs]);

  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach(j => j.required_skills.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [jobs]);

  const scoreDistribution = useMemo(() => {
    const high = resumes.filter(r => (r.ats_score || 0) >= 70).length;
    const mid = resumes.filter(r => (r.ats_score || 0) >= 40 && (r.ats_score || 0) < 70).length;
    const low = resumes.filter(r => (r.ats_score || 0) < 40).length;
    return [
      { name: "High (70%+)", value: high, color: "#10b981" },
      { name: "Mid (40–70%)", value: mid, color: "#f59e0b" },
      { name: "Low (<40%)", value: low, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [resumes]);

  const topCandidateSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    resumes.forEach(r => (r.extracted_skills || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [resumes]);

  const avgScore = resumes.length
    ? Math.round(resumes.reduce((a, r) => a + (r.ats_score || 0), 0) / resumes.length)
    : 0;

  if (jobs.length === 0 && resumes.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Post jobs and have candidates upload resumes to see analytics."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs Posted", value: jobs.length, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Candidate Pool", value: resumes.length, color: "text-sky-500", bg: "bg-sky-500/10" },
          { label: "Avg Candidate Score", value: `${avgScore}%`, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          {
            label: "Unique Skills Required",
            value: new Set(jobs.flatMap(j => j.required_skills)).size,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`card p-4 ${bg}`}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly jobs chart */}
        {monthlyJobs.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Jobs Posted Over Time</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthlyJobs}>
                <defs>
                  <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Jobs"]} />
                <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#jobGrad)" strokeWidth={2}
                  dot={{ fill: "#8b5cf6", r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Candidate score distribution */}
        {scoreDistribution.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Candidate Score Distribution</h3>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {scoreDistribution.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Candidates"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {scoreDistribution.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top required skills */}
      {topSkills.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Most In-Demand Skills (Job Requirements)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topSkills} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Job Postings"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {topSkills.map((_, i) => (
                  <Cell key={i} fill={["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top candidate skills */}
      {topCandidateSkills.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Most Common Candidate Skills</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topCandidateSkills} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Candidates"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {topCandidateSkills.map((_, i) => (
                  <Cell key={i} fill={["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [jobSearch, setJobSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [editingJob, setEditingJob] = useState<JobRow | null>(null);
  const [scoreFilter, setScoreFilter] = useState<"all" | "high" | "mid" | "low">("all");
  const [sortBy, setSortBy] = useState<"score" | "date" | "name">("score");

  const { data, isLoading, error, refetch } = useQuery<RecruiterData>({
    queryKey: ["dashboard", "recruiter"],
    queryFn: () => dashboardApi.recruiter().then(r => r.data),
  });

  const { data: allResumes = [], isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ["resumes", "all"],
    queryFn: () => resumeApi.list().then(r => r.data),
    enabled: activeTab === "candidates" || activeTab === "analytics",
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

  const handleEditSave = async (id: number, formData: Partial<JobRow>) => {
    try {
      const job = data?.jobs.find(j => j.id === id);
      if (!job) return;
      await jobApi.update(id, {
        title: formData.title || job.title,
        company: formData.company ?? job.company,
        location: formData.location ?? job.location,
        description: formData.description || job.description || "",
        required_skills: formData.required_skills || job.required_skills,
        preferred_skills: [],
        experience_required: formData.experience_required ?? job.experience_required,
        education_required: formData.education_required ?? job.education_required ?? null,
      });
      toast.success("Job updated");
      setEditingJob(null);
      refetch();
    } catch {
      toast.error("Failed to update job");
    }
  };

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    const q = jobSearch.toLowerCase();
    return data.jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      (j.company ?? "").toLowerCase().includes(q) ||
      (j.location ?? "").toLowerCase().includes(q) ||
      j.required_skills.some(s => s.toLowerCase().includes(q))
    );
  }, [data, jobSearch]);

  const filteredCandidates = useMemo(() => {
    let list = [...allResumes];
    const q = candidateSearch.toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.candidate_name ?? "").toLowerCase().includes(q) ||
        (r.candidate_email ?? "").toLowerCase().includes(q) ||
        (r.extracted_skills ?? []).some(s => s.toLowerCase().includes(q))
      );
    }
    if (scoreFilter === "high") list = list.filter(r => (r.ats_score || 0) >= 70);
    else if (scoreFilter === "mid") list = list.filter(r => (r.ats_score || 0) >= 40 && (r.ats_score || 0) < 70);
    else if (scoreFilter === "low") list = list.filter(r => (r.ats_score || 0) < 40);
    list.sort((a, b) => {
      if (sortBy === "score") return (b.ats_score || 0) - (a.ats_score || 0);
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return (a.candidate_name || "").localeCompare(b.candidate_name || "");
    });
    return list;
  }, [allResumes, candidateSearch, scoreFilter, sortBy]);

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

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "pipeline", label: "Job Pipeline", icon: Briefcase, count: data?.total_jobs },
    { id: "candidates", label: "Candidate Pool", icon: Users, count: data?.total_candidates },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <Layout title="Recruiter Dashboard">
      <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
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
            <StatsCard title="Active Jobs"       value={data!.total_jobs}       icon={Briefcase}  color="violet"  delay={0}    />
            <StatsCard title="Candidate Pool"    value={data!.total_candidates} icon={Users}      color="sky"     delay={0.05} />
            <StatsCard title="Jobs This Month"   value={data!.jobs_this_month}  icon={TrendingUp} color="emerald" delay={0.1}  />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-surface)" }}>
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-violet-500 text-white shadow-md shadow-violet-500/25"
                  : "hover:opacity-80"
              }`}
              style={{ color: activeTab === id ? undefined : "var(--text-secondary)" }}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === id ? "bg-white/20 text-white" : "bg-violet-500/10 text-violet-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {/* ── Pipeline Tab ── */}
          {activeTab === "pipeline" && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid lg:grid-cols-3 gap-6"
            >
              {/* LEFT — job list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                    Job Pipeline
                  </h3>
                  <Link to="/jobs/create" className="flex items-center gap-1 text-xs font-medium text-violet-500 hover:text-violet-400 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add new
                  </Link>
                </div>

                {!isLoading && data!.jobs.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      placeholder="Search jobs, companies, skills…"
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </div>
                )}

                {isLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} lines={2} />)}</div>
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
                      description={`No jobs match "${jobSearch}". Try a different search term.`}
                      action={{ label: "Clear search", onClick: () => setJobSearch("") }}
                    />
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-3">
                      {filteredJobs.map(j => (
                        <JobCard key={j.id} job={j} onDelete={handleDelete} onEdit={setEditingJob} />
                      ))}
                    </div>
                  </AnimatePresence>
                )}
              </div>

              {/* RIGHT — sidebar */}
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Pipeline Summary</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Open Positions", value: isLoading ? "—" : data!.total_jobs, color: "text-violet-500" },
                      { label: "Candidate Pool", value: isLoading ? "—" : data!.total_candidates, color: "text-sky-500" },
                      { label: "New This Month", value: isLoading ? "—" : data!.jobs_this_month, color: "text-emerald-500" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                        </div>
                        <span className={`text-sm font-bold ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!isLoading && data!.jobs.length > 0 && (() => {
                  const skillCounts: Record<string, number> = {};
                  data!.jobs.forEach(j => j.required_skills.forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; }));
                  const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([skill]) => skill);
                  return topSkills.length > 0 ? (
                    <div className="card p-5">
                      <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>Most Sought Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {topSkills.map(skill => <SkillBadge key={skill} skill={skill} />)}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="card p-5 space-y-2">
                  <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>Quick Actions</h3>
                  {[
                    { label: "Post a new job", icon: Plus, path: "/jobs/create", desc: "Create job posting" },
                    {
                      label: "View rankings",
                      icon: Target,
                      path: data && data.jobs.length > 0 ? `/ranking/${data.jobs[0].id}` : "/jobs/create",
                      desc: "AI candidate matching",
                    },
                    { label: "Candidate Pool", icon: Users, path: "#", desc: "Browse all candidates", onClick: () => setActiveTab("candidates") },
                    { label: "Analytics", icon: BarChart3, path: "#", desc: "View hiring insights", onClick: () => setActiveTab("analytics") },
                  ].map(({ label, icon: Icon, path, desc, onClick }) =>
                    onClick ? (
                      <button
                        key={label}
                        onClick={onClick}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 text-left ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-40" style={{ color: "var(--text-muted)" }} />
                      </button>
                    ) : (
                      <Link
                        key={label}
                        to={path}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-150 group ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
                      </Link>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Candidate Pool Tab ── */}
          {activeTab === "candidates" && (
            <motion.div
              key="candidates"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Search + filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={e => setCandidateSearch(e.target.value)}
                    placeholder="Search by name, email, or skill…"
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-sky-500/30 transition-all"
                    style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={scoreFilter}
                    onChange={e => setScoreFilter(e.target.value as "all" | "high" | "mid" | "low")}
                    className="px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-sky-500/30 transition-all"
                    style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <option value="all">All Scores</option>
                    <option value="high">High (70%+)</option>
                    <option value="mid">Mid (40–70%)</option>
                    <option value="low">Low (&lt;40%)</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as "score" | "date" | "name")}
                    className="px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-sky-500/30 transition-all"
                    style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <option value="score">Sort: Score</option>
                    <option value="date">Sort: Recent</option>
                    <option value="name">Sort: Name</option>
                  </select>
                </div>
              </div>

              {/* Stats bar */}
              {!resumesLoading && allResumes.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl text-xs flex-wrap" style={{ backgroundColor: "var(--bg-surface)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{filteredCandidates.length} shown</span>
                  <span className="text-emerald-500 font-medium">
                    {allResumes.filter(r => (r.ats_score || 0) >= 70).length} high-fit
                  </span>
                  <span className="text-amber-500 font-medium">
                    {allResumes.filter(r => (r.ats_score || 0) >= 40 && (r.ats_score || 0) < 70).length} mid-fit
                  </span>
                  <span className="text-red-400 font-medium">
                    {allResumes.filter(r => (r.ats_score || 0) < 40).length} low-fit
                  </span>
                </div>
              )}

              {resumesLoading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} lines={2} />)}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={Users}
                    title={allResumes.length === 0 ? "No candidates yet" : "No candidates match your filters"}
                    description={
                      allResumes.length === 0
                        ? "Candidates need to sign up and upload their resumes to appear here."
                        : "Try adjusting your search or score filter."
                    }
                    action={candidateSearch || scoreFilter !== "all"
                      ? { label: "Clear filters", onClick: () => { setCandidateSearch(""); setScoreFilter("all"); } }
                      : undefined}
                  />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredCandidates.map(r => (
                      <CandidateCard key={r.id} resume={r} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Rank CTA */}
              {!resumesLoading && filteredCandidates.length > 0 && data && data.jobs.length > 0 && (
                <div className="card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Ready to rank candidates?</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Use AI to match and rank all candidates against a specific job.
                      </p>
                    </div>
                  </div>
                  <Link to={`/ranking/${data.jobs[0].id}`} className="btn-primary text-xs flex-shrink-0">
                    <Star className="w-3.5 h-3.5" />
                    Rank for {data.jobs[0].title.slice(0, 20)}{data.jobs[0].title.length > 20 ? "…" : ""}
                  </Link>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Analytics Tab ── */}
          {activeTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {isLoading || resumesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} lines={3} />)}
                </div>
              ) : (
                <AnalyticsPanel jobs={data!.jobs} resumes={allResumes} isDark={isDark} />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Edit Job Modal */}
      <AnimatePresence>
        {editingJob && (
          <EditJobModal
            job={editingJob}
            onClose={() => setEditingJob(null)}
            onSave={handleEditSave}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
