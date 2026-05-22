import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Mail, Phone, MapPin, BookOpen, Clock,
  CheckCircle, AlertTriangle, MessageSquare, Briefcase,
  TrendingUp, Award, Target, ChevronRight,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell,
} from "recharts";
import Layout from "../components/layout/Layout";
import ScoreRing from "../components/ui/ScoreRing";
import SkillBadge from "../components/ui/SkillBadge";
import { SkeletonCard } from "../components/ui/Skeleton";
import ErrorBoundary from "../components/error/ErrorBoundary";
import EmptyState from "../components/ui/EmptyState";
import { resumeApi, analysisApi } from "../lib/api";
import { useThemeStore } from "../stores/themeStore";
import { Resume, ATSScore } from "../types";

// ── helpers ───────────────────────────────────────────────────────────────────

function scoreLabel(s: number) {
  if (s >= 80) return { text: "Excellent", color: "text-emerald-500" };
  if (s >= 65) return { text: "Good",      color: "text-sky-500"     };
  if (s >= 45) return { text: "Fair",      color: "text-amber-500"   };
  return              { text: "Needs Work", color: "text-red-400"     };
}

function eduScore(edu: string | null | undefined) {
  const map: Record<string, number> = {
    "PhD": 100, "Master's": 85, "Bachelor's": 70,
    "Associate/Diploma": 50, "High School": 30,
  };
  return map[edu ?? ""] ?? 45;
}

// ── sub-components ────────────────────────────────────────────────────────────

function ScoreBar({
  label, value, color,
}: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {Math.round(value)}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--border-color)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function FeedbackBlock({ text }: { text: string }) {
  // Render the template-based feedback as structured blocks
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="text-sm font-bold mt-3 first:mt-0"
              style={{ color: "var(--text-primary)" }}
            >
              {line.replace("## ", "")}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="text-xs font-semibold uppercase tracking-wide mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              {line.replace("### ", "")}
            </h4>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (/^\d+\./.test(line)) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-sky-500 font-bold text-xs mt-0.5 flex-shrink-0">
                {line.match(/^\d+/)?.[0]}.
              </span>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {line.replace(/^\d+\.\s*/, "")}
              </p>
            </div>
          );
        }
        return (
          <p key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {line.replace(/\*\*/g, "")}
          </p>
        );
      })}
    </div>
  );
}

function JobMatchCard({ score, index }: { score: ATSScore; index: number }) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const label = scoreLabel(score.overall_score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-violet-500" />
          </div>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Job #{score.job_id}
          </span>
        </div>
        <span className={`text-lg font-bold ${label.color}`}>
          {score.overall_score.toFixed(0)}%
        </span>
      </div>

      <div className="space-y-2">
        <ScoreBar label="Skill Match"  value={score.skill_match_score}  color="bg-sky-500"     />
        <ScoreBar label="Experience"   value={score.experience_score}   color="bg-violet-500"  />
        <ScoreBar label="Education"    value={score.education_score}    color="bg-amber-500"   />
        <ScoreBar label="Relevance"    value={score.semantic_similarity} color="bg-emerald-500" />
      </div>

      <div className="flex flex-wrap gap-1 pt-1">
        {score.matched_skills.slice(0, 4).map((s) => (
          <SkillBadge key={s} skill={s} variant="matched" />
        ))}
        {score.missing_skills.slice(0, 3).map((s) => (
          <SkillBadge key={s} skill={s} variant="missing" />
        ))}
      </div>

      {score.interview_questions?.length > 0 && (
        <details className="group">
          <summary
            className="text-xs font-medium cursor-pointer flex items-center gap-1 select-none"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
            {score.interview_questions.length} interview questions
          </summary>
          <ul className="mt-2 space-y-1.5 pl-4">
            {score.interview_questions.slice(0, 5).map((q, i) => (
              <li key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {i + 1}. {q}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link
        to={`/ranking/${score.job_id}`}
        className="flex items-center gap-1 text-xs font-medium text-violet-500 hover:text-violet-400 transition-colors"
      >
        View rankings for this job <ChevronRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function ResumeAnalysis() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const id = parseInt(resumeId ?? "0", 10);

  const {
    data: resume,
    isLoading,
    error,
  } = useQuery<Resume>({
    queryKey: ["resume", id],
    queryFn: () => resumeApi.get(id).then((r) => r.data),
    enabled: id > 0,
  });

  const { data: jobScores = [] } = useQuery<ATSScore[]>({
    queryKey: ["ats-scores", "resume", id],
    queryFn: () => analysisApi.getResumeScores(id).then((r) => r.data),
    enabled: id > 0,
  });

  if (isLoading) {
    return (
      <Layout title="Resume Analysis">
        <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-6">
          <div className="h-5 w-24 skeleton rounded" />
          <SkeletonCard lines={3} />
          <div className="grid lg:grid-cols-3 gap-6">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !resume) {
    return (
      <Layout title="Resume Analysis">
        <div className="p-5 max-w-xl mx-auto">
          <ErrorBoundary>
            <EmptyState
              icon={AlertTriangle}
              title="Resume not found"
              description="This resume may have been deleted or you don't have access to it."
              action={{ label: "Back to Dashboard", onClick: () => history.back() }}
            />
          </ErrorBoundary>
        </div>
      </Layout>
    );
  }

  const label = scoreLabel(resume.ats_score ?? 0);

  // Derived scores for breakdown display
  const skillScore   = Math.min(100, ((resume.extracted_skills?.length ?? 0) / 18) * 100);
  const expScore     = Math.min(100, ((resume.experience_years ?? 0) / 8) * 100);
  const eduScoreVal  = eduScore(resume.education_level);
  const completeness = (
    (resume.candidate_name  ? 25 : 0) +
    (resume.candidate_email ? 25 : 0) +
    (resume.candidate_phone ? 15 : 0) +
    (resume.candidate_location ? 10 : 0) + 25
  );

  const radarData = [
    { subject: "Skills",       A: Math.round(skillScore)   },
    { subject: "Experience",   A: Math.round(expScore)     },
    { subject: "Education",    A: Math.round(eduScoreVal)  },
    { subject: "Completeness", A: Math.round(completeness) },
    { subject: "ATS Score",    A: Math.round(resume.ats_score ?? 0) },
  ];

  const breakdownData = [
    { name: "Skills",       value: Math.round(skillScore),   fill: "#0ea5e9" },
    { name: "Experience",   value: Math.round(expScore),     fill: "#8b5cf6" },
    { name: "Education",    value: Math.round(eduScoreVal),  fill: "#f59e0b" },
    { name: "Completeness", value: Math.round(completeness), fill: "#10b981" },
  ];

  return (
    <Layout title="Resume Analysis">
      <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-6 animate-fade-in">

        {/* Back */}
        <Link
          to="/candidate"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* ── Header card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 flex flex-col sm:flex-row items-start gap-5"
        >
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {((resume.candidate_name || resume.original_name)?.[0] ?? "R").toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {resume.candidate_name || "Resume Analysis"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {resume.original_name}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {[
                { icon: Mail,   val: resume.candidate_email    },
                { icon: Phone,  val: resume.candidate_phone    },
                { icon: MapPin, val: resume.candidate_location },
              ].filter((c) => c.val).map(({ icon: Icon, val }) => (
                <span key={val} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Icon className="w-3 h-3" /> {val}
                </span>
              ))}
            </div>
            {resume.summary && (
              <p className="text-xs mt-3 leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {resume.summary}
              </p>
            )}
          </div>

          {/* Score badge */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className={`text-4xl font-extrabold tabular-nums ${label.color}`}>
              {(resume.ats_score ?? 0).toFixed(0)}
            </span>
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              ATS Score
            </span>
            <span className={`text-xs font-semibold ${label.color}`}>{label.text}</span>
          </div>
        </motion.div>

        {/* ── Score row ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Score ring + breakdown bars */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Overall Score
            </h3>
            <div className="flex justify-center">
              <ScoreRing score={resume.ats_score ?? 0} size={120} />
            </div>
            <div className="space-y-2.5">
              <ScoreBar label="Skills Breadth"  value={skillScore}   color="bg-sky-500"    />
              <ScoreBar label="Experience"       value={expScore}     color="bg-violet-500" />
              <ScoreBar label="Education"        value={eduScoreVal}  color="bg-amber-500"  />
              <ScoreBar label="Completeness"     value={completeness} color="bg-emerald-500"/>
            </div>
          </div>

          {/* Radar */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
              Profile Radar
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={isDark ? "#334155" : "#e2e8f0"} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 10 }}
                />
                <Radar
                  dataKey="A"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Candidate details */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Candidate Details
            </h3>
            {[
              { icon: User,     label: "Name",       val: resume.candidate_name   || "Not detected" },
              { icon: Clock,    label: "Experience",  val: `${(resume.experience_years ?? 0).toFixed(0)} years` },
              { icon: BookOpen, label: "Education",   val: resume.education_level  || "Not specified" },
              { icon: Award,    label: "Skills",      val: `${resume.extracted_skills?.length ?? 0} detected` },
              { icon: TrendingUp, label: "ATS Score", val: `${(resume.ats_score ?? 0).toFixed(1)} / 100` },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--border-color)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {val}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Skills + Strengths/Weaknesses ── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Extracted skills */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-sky-500" />
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Extracted Skills
                <span
                  className="ml-2 text-xs font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  ({resume.extracted_skills?.length ?? 0})
                </span>
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(resume.extracted_skills ?? []).map((s) => (
                <SkillBadge key={s} skill={s} variant="matched" />
              ))}
              {(resume.extracted_skills?.length ?? 0) === 0 && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No skills detected — try a more detailed resume
                </p>
              )}
            </div>
          </div>

          {/* Strengths + weaknesses */}
          <div className="card p-5 space-y-4">
            {(resume.strengths?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    Strengths
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {(resume.strengths ?? []).map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {s}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(resume.weaknesses?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    Areas to Improve
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {(resume.weaknesses ?? []).map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {w}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(resume.strengths?.length ?? 0) === 0 && (resume.weaknesses?.length ?? 0) === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Analysis complete — re-upload to regenerate insights.
              </p>
            )}
          </div>
        </div>

        {/* ── Score breakdown bar chart ── */}
        <div className="card p-5">
          <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>
            Score Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={breakdownData} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                formatter={(v: number) => [`${v}%`, ""]}
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {breakdownData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── AI Feedback ── */}
        {resume.ai_feedback && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-sky-500" />
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                AI Feedback
              </h3>
            </div>
            <FeedbackBlock text={resume.ai_feedback} />
          </div>
        )}

        {/* ── Job Match Analysis ── */}
        {jobScores.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                Job Match Analysis
                <span
                  className="ml-2 text-xs font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  ({jobScores.length} {jobScores.length === 1 ? "job" : "jobs"})
                </span>
              </h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {jobScores.map((s, i) => (
                <JobMatchCard key={s.id} score={s} index={i} />
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
