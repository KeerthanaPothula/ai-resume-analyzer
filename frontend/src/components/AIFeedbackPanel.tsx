import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Loader2, Lightbulb, Target, Zap, ChevronRight,
  Sparkles, RefreshCw, MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { aiFeedbackApi } from "../lib/api";
import { AIFeedback, JobMatchFeedback } from "../types";
import SkillBadge from "./ui/SkillBadge";

// ── Provider badge ────────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    openai:   { label: "GPT-4o-mini",     cls: "bg-emerald-500/10 text-emerald-500" },
    gemini:   { label: "Gemini",           cls: "bg-sky-500/10 text-sky-500"         },
    template: { label: "Template-based",  cls: "bg-slate-400/10 text-slate-400"     },
  };
  const { label, cls } = map[provider] ?? map.template;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type ResumeTab = "summary" | "improvements" | "ats";
type JobTab    = "analysis" | "questions"   | "tips";

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; icon: React.ElementType }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-lg transition-all ${
            active === key
              ? "bg-violet-500 text-white shadow-sm"
              : "hover:opacity-70"
          }`}
          style={active !== key ? { color: "var(--text-muted)" } : {}}
        >
          <Icon className="w-3 h-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── General Resume Feedback ───────────────────────────────────────────────────

export function AIResumeFeedbackPanel({ resumeId }: { resumeId: number }) {
  const [tab, setTab] = useState<ResumeTab>("summary");
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      aiFeedbackApi.resumeFeedback(resumeId).then((r) => r.data as AIFeedback),
    onSuccess: (data) => {
      setFeedback(data);
      toast.success("AI feedback generated");
    },
    onError: () => toast.error("Failed to generate feedback — check server logs"),
  });

  const resumeTabs: { key: ResumeTab; label: string; icon: React.ElementType }[] = [
    { key: "summary",      label: "Summary",      icon: Brain     },
    { key: "improvements", label: "Improvements", icon: Lightbulb },
    { key: "ats",          label: "ATS Tips",     icon: Target    },
  ];

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            AI-Powered Feedback
          </h3>
          {feedback && <ProviderBadge provider={feedback.provider} />}
        </div>

        {!feedback ? (
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="btn-primary text-xs py-1.5 px-3 gap-1.5"
          >
            {isPending
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</>
              : <><Zap className="w-3 h-3" /> Generate</>}
          </button>
        ) : (
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="btn-secondary text-xs py-1 px-2.5 gap-1"
          >
            {isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><RefreshCw className="w-3 h-3" /> Regenerate</>}
          </button>
        )}
      </div>

      {/* Empty / loading state */}
      {!feedback && !isPending && (
        <div className="text-center py-8">
          <Brain
            className="w-10 h-10 mx-auto mb-3 opacity-20"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Generate personalized AI feedback
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Improvement suggestions, ATS tips, and an AI-written profile summary
          </p>
        </div>
      )}

      {isPending && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-500" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Analyzing resume…
          </p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {feedback && !isPending && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <TabBar tabs={resumeTabs} active={tab} onChange={setTab} />

            {tab === "summary" && (
              <div className="space-y-3">
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {feedback.summary}
                </p>

                {feedback.overall_assessment && (
                  <div
                    className="p-3 rounded-xl text-xs leading-relaxed"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Assessment:{" "}
                    </span>
                    {feedback.overall_assessment}
                  </div>
                )}

                {feedback.missing_skills.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-medium mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Suggested skills to add
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {feedback.missing_skills.map((s) => (
                        <SkillBadge key={s} skill={s} variant="missing" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "improvements" && (
              <ul className="space-y-2.5">
                {feedback.improvement_suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {s}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {tab === "ats" && (
              <ul className="space-y-2">
                {feedback.ats_optimization_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {tip}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Job-specific Match Feedback ───────────────────────────────────────────────

export function AIJobMatchPanel({
  resumeId,
  jobId,
  jobTitle,
}: {
  resumeId: number;
  jobId: number;
  jobTitle?: string;
}) {
  const [tab, setTab] = useState<JobTab>("analysis");
  const [feedback, setFeedback] = useState<JobMatchFeedback | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      aiFeedbackApi
        .jobMatchFeedback(resumeId, jobId)
        .then((r) => r.data as JobMatchFeedback),
    onSuccess: (data) => {
      setFeedback(data);
      toast.success("Job match analysis ready");
    },
    onError: () => toast.error("Failed to generate job match analysis"),
  });

  const jobTabs: { key: JobTab; label: string; icon: React.ElementType }[] = [
    { key: "analysis",  label: "Match Analysis", icon: Target       },
    { key: "questions", label: "Interview Prep",  icon: MessageSquare },
    { key: "tips",      label: "ATS Tips",        icon: Lightbulb    },
  ];

  const recColor = (rec: string) => {
    if (rec.startsWith("Strong")) return "text-emerald-500";
    if (rec.startsWith("Good"))   return "text-sky-500";
    if (rec.startsWith("Moderate")) return "text-amber-500";
    return "text-red-400";
  };

  return (
    <div className="card p-4 space-y-3 border-l-2 border-violet-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            AI Analysis{jobTitle ? ` — ${jobTitle}` : ""}
          </span>
          {feedback && <ProviderBadge provider={feedback.provider} />}
        </div>

        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="btn-secondary text-xs py-1 px-2.5 gap-1"
        >
          {isPending
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : feedback
            ? <><RefreshCw className="w-3 h-3" /> Refresh</>
            : <><Zap className="w-3 h-3" /> Analyze</>}
        </button>
      </div>

      {!feedback && !isPending && (
        <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
          Click Analyze for AI-powered match insight, interview prep &amp; ATS tips
        </p>
      )}

      {isPending && (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Analyzing…
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {feedback && !isPending && (
          <motion.div
            key="job-result"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {feedback.recommendation && (
              <p className={`text-xs font-semibold ${recColor(feedback.recommendation)}`}>
                {feedback.recommendation}
              </p>
            )}

            <TabBar tabs={jobTabs} active={tab} onChange={setTab} />

            {tab === "analysis" && (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {feedback.match_analysis}
                </p>
                {feedback.missing_skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Critical skill gaps
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {feedback.missing_skills.map((s) => (
                        <SkillBadge key={s} skill={s} variant="missing" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "questions" && (
              <ul className="space-y-2">
                {feedback.interview_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="text-[10px] font-bold text-violet-500 flex-shrink-0 mt-0.5"
                      style={{ minWidth: "1rem" }}
                    >
                      Q{i + 1}
                    </span>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {q}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {tab === "tips" && (
              <ul className="space-y-2">
                {feedback.ats_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {tip}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
