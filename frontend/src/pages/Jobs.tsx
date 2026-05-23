import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, MapPin, GraduationCap, Clock, Search,
  ChevronDown, CheckCircle2, X, Loader2, FileText, Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import { jobApi, resumeApi, applicationApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

interface Job {
  id: number;
  title: string;
  company?: string;
  location?: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_required: number;
  education_required?: string;
  created_at: string;
}

interface Resume {
  id: number;
  original_name: string;
  candidate_name?: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface ApplyModalProps {
  job: Job;
  resumes: Resume[];
  onClose: () => void;
  onSuccess: () => void;
}

function ApplyModal({ job, resumes, onClose, onSuccess }: ApplyModalProps) {
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(
    resumes.length === 1 ? resumes[0].id : null
  );
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => applicationApi.apply(job.id, selectedResumeId!),
    onSuccess: () => {
      toast.success("Application submitted!");
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Failed to submit application";
      toast.error(msg);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Apply to {job.title}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {job.company}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {resumes.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              No resumes uploaded yet
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Upload a resume before applying
            </p>
            <button
              onClick={() => { onClose(); window.location.href = "/upload"; }}
              className="btn-primary text-sm"
            >
              Upload Resume
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
              Select a resume to apply with:
            </p>
            <div className="space-y-2 mb-4">
              {resumes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResumeId(r.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                    selectedResumeId === r.id
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-transparent hover:border-sky-500/40"
                  }`}
                  style={selectedResumeId !== r.id ? { borderColor: "var(--border-color)" } : {}}
                >
                  <FileText
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: selectedResumeId === r.id ? "var(--accent)" : "var(--text-muted)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {r.original_name}
                    </p>
                    {r.candidate_name && (
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {r.candidate_name}
                      </p>
                    )}
                  </div>
                  {selectedResumeId === r.id && (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-sky-500" />
                  )}
                </button>
              ))}
            </div>

            {!confirmed ? (
              <button
                disabled={!selectedResumeId}
                onClick={() => setConfirmed(true)}
                className="btn-primary w-full justify-center"
              >
                Continue
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)" }}>
                  <p style={{ color: "var(--text-secondary)" }}>
                    You are applying to <strong style={{ color: "var(--text-primary)" }}>{job.title}</strong>
                    {job.company && <> at <strong style={{ color: "var(--text-primary)" }}>{job.company}</strong></>}.
                    Your ATS score will be calculated automatically.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmed(false)} className="btn-ghost flex-1 justify-center text-sm">
                    Back
                  </button>
                  <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="btn-primary flex-1 justify-center text-sm"
                  >
                    {mutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                    ) : (
                      "Confirm & Apply"
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

interface JobCardProps {
  job: Job;
  appliedJobIds: Set<number>;
  onApply: (job: Job) => void;
}

function JobCard({ job, appliedJobIds, onApply }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const alreadyApplied = appliedJobIds.has(job.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate" style={{ color: "var(--text-primary)" }}>
            {job.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {job.company && (
              <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <MapPin className="w-3 h-3" /> {job.location}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-3 h-3" /> {timeAgo(job.created_at)}
            </span>
          </div>
        </div>

        <button
          onClick={() => onApply(job)}
          disabled={alreadyApplied}
          className={alreadyApplied ? "btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5" : "btn-primary text-xs px-3 py-1.5"}
        >
          {alreadyApplied ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Applied</>
          ) : (
            "Apply Now"
          )}
        </button>
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-2">
        {job.experience_required > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
            style={{ backgroundColor: "var(--bg-base)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
            <Briefcase className="w-3 h-3" /> {job.experience_required}+ yrs
          </span>
        )}
        {job.education_required && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
            style={{ backgroundColor: "var(--bg-base)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
            <GraduationCap className="w-3 h-3" /> {job.education_required}
          </span>
        )}
      </div>

      {/* Skills */}
      {job.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.required_skills.slice(0, 6).map((skill) => (
            <span key={skill} className="skill-badge text-xs">{skill}</span>
          ))}
          {job.required_skills.length > 6 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              +{job.required_skills.length - 6} more
            </span>
          )}
        </div>
      )}

      {/* Description toggle */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          {expanded ? "Show less" : "View description"}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap line-clamp-10"
                style={{ color: "var(--text-secondary)" }}>
                {job.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Jobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "experience">("newest");
  const [applyTarget, setApplyTarget] = useState<Job | null>(null);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: () => jobApi.list().then((r) => r.data),
    staleTime: 1000 * 60,
  });

  const { data: resumes = [] } = useQuery<Resume[]>({
    queryKey: ["resumes"],
    queryFn: () => resumeApi.list().then((r) => r.data),
    enabled: user?.role === "candidate",
  });

  const { data: myApps = [] } = useQuery<{ job_id: number }[]>({
    queryKey: ["my-applications"],
    queryFn: () => import("../lib/api").then((m) => m.rankingApi.myApplications().then((r) => r.data)),
    enabled: user?.role === "candidate",
  });

  const appliedJobIds = useMemo(
    () => new Set((myApps as { job_id: number }[]).map((a) => a.job_id)),
    [myApps]
  );

  const filtered = useMemo(() => {
    let list = [...jobs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.company ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          j.required_skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      list.sort((a, b) => b.experience_required - a.experience_required);
    }
    return list;
  }, [jobs, search, sortBy]);

  const handleApplySuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["my-applications"] });
  };

  return (
    <Layout title="Browse Jobs">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Browse Jobs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {jobs.length} open position{jobs.length !== 1 ? "s" : ""} available
          </p>
        </div>

        {/* Search + sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search jobs, skills, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "experience")}
            className="input px-3 cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="experience">Experience</option>
          </select>
        </div>

        {/* Candidate hint if no resumes */}
        {user?.role === "candidate" && resumes.length === 0 && !jobsLoading && jobs.length > 0 && (
          <div className="card p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Upload your resume to apply
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                You need at least one resume uploaded before you can apply to jobs.
              </p>
            </div>
            <button onClick={() => navigate("/upload")} className="btn-primary text-xs flex-shrink-0">
              Upload
            </button>
          </div>
        )}

        {/* Job list */}
        {jobsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-5 w-48 rounded" style={{ backgroundColor: "var(--border-color)" }} />
                <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--border-color)" }} />
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-5 w-16 rounded" style={{ backgroundColor: "var(--border-color)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 flex flex-col items-center text-center">
            <Briefcase className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
              {search ? "No jobs match your search" : "No jobs posted yet"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {search ? "Try different keywords" : "Check back soon for new opportunities"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                appliedJobIds={appliedJobIds}
                onApply={setApplyTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Apply modal */}
      <AnimatePresence>
        {applyTarget && (
          <ApplyModal
            job={applyTarget}
            resumes={resumes as Resume[]}
            onClose={() => setApplyTarget(null)}
            onSuccess={handleApplySuccess}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
