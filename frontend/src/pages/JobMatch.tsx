import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Loader2, Zap, ChevronRight, Target,
  MessageSquare, Lightbulb, TrendingUp, CheckCircle2,
  XCircle, AlertCircle, Sparkles, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import ScoreRing from "../components/ui/ScoreRing";
import SkillBadge from "../components/ui/SkillBadge";
import { resumeApi, aiFeedbackApi } from "../lib/api";
import { Resume, QuickMatchResult } from "../types";

type Tab = "overview" | "skills" | "interview" | "ats";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",   label: "Overview",      icon: TrendingUp    },
  { key: "skills",     label: "Skills Gap",    icon: Target        },
  { key: "interview",  label: "Interview Prep", icon: MessageSquare },
  { key: "ats",        label: "ATS Tips",      icon: Lightbulb     },
];

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const lower = recommendation.toLowerCase();
  const isStrong  = lower.includes("strong");
  const isGood    = lower.includes("good");
  const isModerate = lower.includes("moderate") || lower.includes("consider");

  const cls = isStrong
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    : isGood
    ? "bg-sky-500/10 text-sky-500 border-sky-500/30"
    : isModerate
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-red-500/10 text-red-400 border-red-500/30";

  const Icon = isStrong || isGood ? CheckCircle2 : isModerate ? AlertCircle : XCircle;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${cls}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{recommendation}</span>
    </div>
  );
}

function ScoreSection({ score }: { score: number }) {
  const label = score >= 80 ? "Excellent Match" : score >= 60 ? "Good Match" : score >= 40 ? "Partial Match" : "Poor Match";
  const labelColor = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-sky-500" : score >= 40 ? "text-amber-500" : "text-red-400";

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <ScoreRing score={score} size={140} />
      <div className="text-center">
        <p className={`text-base font-bold ${labelColor}`}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          AI-powered resume-to-job compatibility score
        </p>
      </div>
    </div>
  );
}

export default function JobMatch() {
  const [resumeId, setResumeId] = useState<number | "">("");
  const [jobTitle, setJobTitle]   = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tab, setTab]             = useState<Tab>("overview");
  const [result, setResult]       = useState<QuickMatchResult | null>(null);
  const [matchVersion, setMatchVersion] = useState(0);

  const { data: resumes = [], isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ["resumes"],
    queryFn: () => resumeApi.list().then((r) => r.data),
  });

  const { mutate: analyze, isPending } = useMutation({
    mutationFn: () => {
      if (!resumeId || !jobTitle.trim() || !jobDescription.trim()) {
        throw new Error("Please fill in all fields");
      }
      return aiFeedbackApi
        .quickMatch(resumeId as number, jobTitle.trim(), jobDescription.trim())
        .then((r) => r.data as QuickMatchResult);
    },
    onSuccess: (data) => {
      setResult(data);
      setTab("overview");
      setMatchVersion((v) => v + 1);
      toast.success("Match analysis complete!");
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string; response?: { data?: { detail?: string } } };
      const msg =
        e.response?.data?.detail ??
        (e.code === "ECONNABORTED"
          ? "Request timed out — the server may be starting up. Please wait a moment and try again."
          : e.message === "Network Error"
          ? "Cannot reach the server — it may be starting up. Please wait 30 seconds and try again."
          : e.message) ??
        "Analysis failed — please try again";
      toast.error(msg);
    },
  });

  const canAnalyze = resumeId !== "" && jobTitle.trim().length > 0 && jobDescription.trim().length > 20;

  return (
    <Layout title="Job Match Analyzer">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center shadow-lg">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Job Match Analyzer
            </h1>
          </div>
          <p className="text-sm ml-12" style={{ color: "var(--text-muted)" }}>
            Paste any job description and get an instant AI-powered match score, skill gap analysis, and interview prep.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Input panel ── */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <FileText className="w-4 h-4 text-sky-500" />
                Configure Analysis
              </h2>

              {/* Resume selector */}
              <div>
                <label className="label">Select Your Resume</label>
                {resumesLoading ? (
                  <div className="skeleton h-10 w-full" />
                ) : resumes.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No resumes uploaded yet.{" "}
                    <a href="/upload" className="text-sky-500 hover:underline">Upload one</a> first.
                  </p>
                ) : (
                  <select
                    value={resumeId}
                    onChange={(e) => setResumeId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="input"
                  >
                    <option value="">— Choose a resume —</option>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.original_name} {r.candidate_name ? `(${r.candidate_name})` : ""} — ATS {r.ats_score.toFixed(0)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Job title */}
              <div>
                <label className="label">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="input"
                />
              </div>

              {/* JD textarea */}
              <div>
                <label className="label">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here…"
                  rows={10}
                  className="textarea"
                  style={{ minHeight: "220px" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {jobDescription.length} characters — min 20 required
                </p>
              </div>

              <button
                onClick={() => analyze()}
                disabled={isPending || !canAnalyze}
                className="btn-violet w-full justify-center py-3"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing with Gemini AI…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Analyze Match
                  </>
                )}
              </button>
            </div>

            {/* Tips card */}
            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Tips for best results
              </p>
              {[
                "Paste the complete job description including requirements",
                "Include technical skills, experience level, and responsibilities",
                "Use the most recent version of your resume",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-sky-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Results panel ── */}
          <div>
            <AnimatePresence mode="wait">
              {isPending && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-8 flex flex-col items-center justify-center gap-4 min-h-[400px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      Analyzing your match…
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Gemini AI is comparing your resume against the job requirements
                    </p>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </motion.div>
              )}

              {!isPending && !result && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-8 flex flex-col items-center justify-center gap-4 min-h-[400px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Target className="w-8 h-8 opacity-30" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      No analysis yet
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Fill in the form and click "Analyze Match" to get your AI-powered results
                    </p>
                  </div>
                </motion.div>
              )}

              {!isPending && result && (
                <motion.div
                  key={matchVersion}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Score card */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Match Score
                      </h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">
                        {result.provider === "gemini" ? "Gemini AI" : result.provider === "openai" ? "GPT-4o-mini" : "Template"}
                      </span>
                    </div>
                    <ScoreSection score={result.match_score} />
                    <RecommendationBadge recommendation={result.recommendation} />
                  </div>

                  {/* Tabs */}
                  <div className="card p-5 space-y-4">
                    {/* Tab bar */}
                    <div
                      className="flex gap-1 p-1 rounded-xl overflow-x-auto"
                      style={{ backgroundColor: "var(--bg-surface)" }}
                    >
                      {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setTab(key)}
                          className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 px-1.5 rounded-lg transition-all whitespace-nowrap min-w-0 ${
                            tab === key
                              ? "bg-violet-500 text-white shadow-sm"
                              : "hover:opacity-70"
                          }`}
                          style={tab !== key ? { color: "var(--text-muted)" } : {}}
                        >
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* ── Overview ── */}
                    {tab === "overview" && (
                      <div className="space-y-4">
                        {result.match_analysis && (
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {result.match_analysis}
                          </p>
                        )}
                        {result.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2 text-emerald-500">Strengths</p>
                            <ul className="space-y-1.5">
                              {result.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.growth_areas.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2 text-amber-500">Growth Areas</p>
                            <ul className="space-y-1.5">
                              {result.growth_areas.map((g, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <TrendingUp className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{g}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Skills Gap ── */}
                    {tab === "skills" && (
                      <div className="space-y-4">
                        {result.matched_skills.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2 text-emerald-500">
                              Matched Skills ({result.matched_skills.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.matched_skills.map((s) => (
                                <SkillBadge key={s} skill={s} variant="matched" />
                              ))}
                            </div>
                          </div>
                        )}
                        {result.missing_skills.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2 text-red-400">
                              Missing Skills ({result.missing_skills.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.missing_skills.map((s) => (
                                <SkillBadge key={s} skill={s} variant="missing" />
                              ))}
                            </div>
                          </div>
                        )}
                        {result.matched_skills.length === 0 && result.missing_skills.length === 0 && (
                          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                            No skill data returned — try regenerating the analysis
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Interview Prep ── */}
                    {tab === "interview" && (
                      result.interview_questions.length > 0 ? (
                        <ul className="space-y-3">
                          {result.interview_questions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span
                                className="text-[10px] font-bold text-violet-500 flex-shrink-0 mt-0.5"
                                style={{ minWidth: "1.5rem" }}
                              >
                                Q{i + 1}
                              </span>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                {q}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                          No interview questions generated
                        </p>
                      )
                    )}

                    {/* ── ATS Tips ── */}
                    {tab === "ats" && (
                      result.ats_tips.length > 0 ? (
                        <ul className="space-y-2.5">
                          {result.ats_tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                {tip}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                          No ATS tips generated
                        </p>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}
