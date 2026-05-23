import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Trophy, Users, Loader2, RefreshCw, Medal,
  Star, X, ChevronDown, ChevronUp,
  Briefcase, GraduationCap, MessageSquare, Check,
  BarChart3, Zap, SlidersHorizontal, HelpCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import SkillBadge from '../components/ui/SkillBadge';
import ScoreRing from '../components/ui/ScoreRing';
import EmptyState from '../components/ui/EmptyState';
import { jobApi, resumeApi, rankingApi } from '../lib/api';
import { JobDescription, Resume } from '../types';
import { useThemeStore } from '../stores/themeStore';

interface RankingRow {
  ranking_id?: number;
  rank: number;
  score: number;
  shortlisted: boolean;
  notes: string;
  resume_id: number;
  candidate_name: string | null;
  candidate_email: string | null;
  skills: string[];
  experience_years: number;
  education_level: string | null;
  matched_skills: string[];
  missing_skills: string[];
  skill_match_score: number;
  semantic_similarity: number;
  interview_questions: string[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color = '#0ea5e9' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{Math.round(value || 0)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value || 0}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function CandidateDetail({
  entry,
  onClose,
  onToggleShortlist,
  onSaveNotes,
}: {
  entry: RankingRow;
  onClose: () => void;
  onToggleShortlist: (entry: RankingRow) => void;
  onSaveNotes: (entry: RankingRow, notes: string) => void;
}) {
  const [notes, setNotes] = useState(entry.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSaveNotes = async () => {
    setSaving(true);
    await onSaveNotes(entry, notes);
    setSaving(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
              {(entry.candidate_name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {entry.candidate_name || `Candidate #${entry.rank}`}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {entry.candidate_email || 'No email'} · Rank #{entry.rank}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleShortlist(entry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                entry.shortlisted
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                  : 'hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30'
              }`}
              style={{ borderColor: entry.shortlisted ? undefined : 'var(--border-color)', color: entry.shortlisted ? undefined : 'var(--text-secondary)' }}
            >
              {entry.shortlisted
                ? <Star className="w-3.5 h-3.5 fill-amber-500" />
                : <Star className="w-3.5 h-3.5" />}
              {entry.shortlisted ? 'Shortlisted' : 'Shortlist'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors">
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Score summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Overall Score', value: entry.score, color: 'text-sky-500', bg: 'bg-sky-500/10' },
              { label: 'Skill Match', value: entry.skill_match_score, color: 'text-violet-500', bg: 'bg-violet-500/10' },
              { label: 'Semantic Fit', value: entry.semantic_similarity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${bg}`}>
                <p className={`text-xl font-bold ${color}`}>{Math.round(value || 0)}%</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Score bars */}
          <div className="card p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Score Breakdown
            </h4>
            <ScoreBar label="Skill Match" value={entry.skill_match_score} color="#8b5cf6" />
            <ScoreBar label="Semantic Similarity" value={entry.semantic_similarity} color="#0ea5e9" />
            <ScoreBar label="Overall Score" value={entry.score} color="#10b981" />
          </div>

          {/* Skills */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Matched Skills</h4>
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.matched_skills?.length ? (
                  entry.matched_skills.map(s => <SkillBadge key={s} skill={s} variant="matched" />)
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None matched</p>
                )}
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <X className="w-3.5 h-3.5 text-red-400" />
                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Missing Skills</h4>
              </div>
              <div className="flex flex-wrap gap-1">
                {entry.missing_skills?.length ? (
                  entry.missing_skills.map(s => <SkillBadge key={s} skill={s} variant="missing" />)
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No gaps</p>
                )}
              </div>
            </div>
          </div>

          {/* Candidate info */}
          <div className="card p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Candidate Info
            </h4>
            {[
              { icon: Briefcase, label: 'Experience', value: `${entry.experience_years?.toFixed(0) || 0} years` },
              { icon: GraduationCap, label: 'Education', value: entry.education_level || 'Not specified' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}:</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Interview questions */}
          {entry.interview_questions && entry.interview_questions.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <HelpCircle className="w-3.5 h-3.5 text-violet-500" />
                <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Suggested Interview Questions</h4>
              </div>
              <ol className="space-y-2">
                {entry.interview_questions.slice(0, 5).map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-xs font-bold text-violet-500 flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{q}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Recruiter notes */}
          <div className="card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Recruiter Notes</h4>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this candidate…"
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving || notes === (entry.notes || '')}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-500 border border-violet-500/25 hover:bg-violet-500/20 transition-all disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const configs: Record<number, { bg: string; border: string; color: string }> = {
    1: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', color: 'text-amber-500' },
    2: { bg: 'bg-slate-400/15', border: 'border-slate-400/40', color: 'text-slate-400' },
    3: { bg: 'bg-orange-500/15', border: 'border-orange-500/40', color: 'text-orange-500' },
  };
  const cfg = configs[rank] || { bg: 'bg-sky-500/10', border: 'border-sky-500/20', color: 'text-sky-500' };
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {rank <= 3 ? <Medal className="w-4 h-4" /> : `#${rank}`}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CandidateRanking() {
  const { jobId } = useParams<{ jobId: string }>();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [job, setJob] = useState<JobDescription | null>(null);
  const [allResumes, setAllResumes] = useState<Resume[]>([]);
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RankingRow | null>(null);
  const [filter, setFilter] = useState<'all' | 'shortlisted'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'skill' | 'semantic'>('score');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const tickColor = isDark ? '#94a3b8' : '#475569';
  const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  const mapRow = (r: any): RankingRow => ({
    ranking_id: r.ranking_id,
    rank: r.rank,
    score: r.score,
    shortlisted: r.shortlisted || false,
    notes: r.notes || '',
    resume_id: r.resume_id,
    candidate_name: r.candidate_name,
    candidate_email: r.candidate_email,
    skills: r.skills || [],
    experience_years: r.experience_years || 0,
    education_level: r.education_level,
    matched_skills: r.matched_skills || [],
    missing_skills: r.missing_skills || [],
    skill_match_score: r.skill_match_score || 0,
    semantic_similarity: r.semantic_similarity || 0,
    interview_questions: r.interview_questions || [],
  });

  const loadData = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [jobRes, resumesRes, rankRes] = await Promise.all([
        jobApi.get(parseInt(jobId)),
        resumeApi.list(),
        rankingApi.getForJob(parseInt(jobId)),
      ]);
      setJob(jobRes.data);
      setAllResumes(resumesRes.data);
      if (rankRes.data.length) {
        setRankings(rankRes.data.map(mapRow));
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRankAll = async () => {
    if (!jobId || allResumes.length === 0) return toast.error('No resumes to rank');
    setRanking(true);
    try {
      await rankingApi.rank(parseInt(jobId), allResumes.map(r => r.id));
      toast.success(`Ranked ${allResumes.length} candidates!`);
      await loadData();
    } catch {
      toast.error('Ranking failed');
    } finally {
      setRanking(false);
    }
  };

  const handleToggleShortlist = async (entry: RankingRow) => {
    if (!entry.ranking_id) {
      toast.error('Save rankings first before shortlisting');
      return;
    }
    const newState = !entry.shortlisted;
    setRankings(prev => prev.map(r => r.resume_id === entry.resume_id ? { ...r, shortlisted: newState } : r));
    if (selectedEntry?.resume_id === entry.resume_id) {
      setSelectedEntry(prev => prev ? { ...prev, shortlisted: newState } : null);
    }
    try {
      await rankingApi.updateEntry(entry.ranking_id, { shortlisted: newState });
      toast.success(newState ? 'Added to shortlist' : 'Removed from shortlist');
    } catch {
      setRankings(prev => prev.map(r => r.resume_id === entry.resume_id ? { ...r, shortlisted: !newState } : r));
      toast.error('Failed to update shortlist');
    }
  };

  const handleSaveNotes = async (entry: RankingRow, notes: string) => {
    if (!entry.ranking_id) return;
    try {
      await rankingApi.updateEntry(entry.ranking_id, { notes });
      setRankings(prev => prev.map(r => r.resume_id === entry.resume_id ? { ...r, notes } : r));
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const shortlistedCount = rankings.filter(r => r.shortlisted).length;

  const filteredRankings = useMemo(() => {
    let list = filter === 'shortlisted' ? rankings.filter(r => r.shortlisted) : [...rankings];
    if (sortBy === 'skill') list.sort((a, b) => (b.skill_match_score || 0) - (a.skill_match_score || 0));
    else if (sortBy === 'semantic') list.sort((a, b) => (b.semantic_similarity || 0) - (a.semantic_similarity || 0));
    else list.sort((a, b) => (b.score || 0) - (a.score || 0));
    return list;
  }, [rankings, filter, sortBy]);

  const chartData = rankings
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(r => ({
      name: (r.candidate_name || `#${r.rank}`).split(' ')[0],
      score: parseFloat((r.score || 0).toFixed(1)),
      shortlisted: r.shortlisted,
    }));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-5 md:p-7 max-w-6xl mx-auto animate-fade-in">

        <Link
          to="/recruiter"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-violet-500" />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {job?.title || 'Candidate Ranking'}
              </h1>
            </div>
            {job?.company && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {job.company}
                {job.location && <span className="ml-2">· {job.location}</span>}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {allResumes.length} in pool · {rankings.length} ranked · {shortlistedCount} shortlisted
            </p>
          </div>
          <button
            onClick={handleRankAll}
            disabled={ranking || allResumes.length === 0}
            className="btn-primary self-start md:self-auto"
          >
            {ranking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {ranking ? 'Ranking…' : rankings.length ? 'Re-rank All' : 'Rank Candidates'}
          </button>
        </div>

        {/* Required skills */}
        {job?.required_skills && job.required_skills.length > 0 && (
          <div className="card p-4 mb-6 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Required:</span>
            {job.required_skills.slice(0, 12).map(s => <SkillBadge key={s} skill={s} />)}
          </div>
        )}

        {rankings.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Users}
              title="No rankings yet"
              description={
                allResumes.length === 0
                  ? "No resumes in the system yet. Candidates need to upload their resumes first."
                  : `Click "Rank Candidates" to AI-score all ${allResumes.length} resume${allResumes.length !== 1 ? 's' : ''} against this job.`
              }
              action={allResumes.length > 0 ? { label: 'Rank Candidates', onClick: handleRankAll } : undefined}
            />
          </div>
        ) : (
          <>
            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-5 mb-6">
              {/* Score distribution */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Score Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Score']} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.shortlisted ? '#f59e0b' : i === 0 ? '#8b5cf6' : i === 1 ? '#0ea5e9' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 3 podium */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Top Candidates</h3>
                </div>
                <div className="space-y-3">
                  {rankings.slice(0, 3).map((r, i) => {
                    const podiumColors = ['#f59e0b', '#9ca3af', '#cd7c2f'];
                    const c = podiumColors[i];
                    return (
                      <div
                        key={r.resume_id}
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setSelectedEntry(r)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ background: `${c}20`, border: `1px solid ${c}40`, color: c }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {r.candidate_name || `Candidate ${r.rank}`}
                          </p>
                          <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${r.score}%`, backgroundColor: c }} />
                          </div>
                        </div>
                        <p className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                          {r.score?.toFixed(1)}%
                        </p>
                        {r.shortlisted && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {shortlistedCount > 0 && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Star className="w-3 h-3 text-amber-500 inline mr-1" />
                      {shortlistedCount} candidate{shortlistedCount !== 1 ? 's' : ''} shortlisted
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Filter + Sort bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                {(['all', 'shortlisted'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      filter === f
                        ? 'bg-violet-500/15 text-violet-500 border-violet-500/30'
                        : 'hover:opacity-80'
                    }`}
                    style={{ borderColor: filter === f ? undefined : 'var(--border-color)', color: filter === f ? undefined : 'var(--text-secondary)' }}
                  >
                    {f === 'all' ? `All (${rankings.length})` : `Shortlisted (${shortlistedCount})`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'score' | 'skill' | 'semantic')}
                  className="px-2.5 py-1.5 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="score">Sort: Overall Score</option>
                  <option value="skill">Sort: Skill Match</option>
                  <option value="semantic">Sort: Semantic Fit</option>
                </select>
              </div>
            </div>

            {/* Full ranking list */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Full Rankings
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)' }}>
                  {filteredRankings.length} candidates
                </span>
              </div>

              {filteredRankings.length === 0 ? (
                <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No shortlisted candidates yet. Click the ★ icon to shortlist.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {filteredRankings.map((r, i) => (
                    <motion.div
                      key={r.resume_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="p-4 transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div className="flex items-start gap-3">
                        <RankBadge rank={r.rank} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {r.candidate_name || `Candidate #${r.rank}`}
                              </p>
                              {r.shortlisted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                              {r.notes && <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {r.experience_years?.toFixed(0) || 0}y exp
                              </span>
                              <button
                                onClick={() => handleToggleShortlist(r)}
                                className={`p-1 rounded transition-all hover:scale-110 ${r.shortlisted ? 'text-amber-500' : ''}`}
                                style={{ color: r.shortlisted ? undefined : 'var(--text-muted)' }}
                                title={r.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                              >
                                {r.shortlisted
                                  ? <Star className="w-3.5 h-3.5 fill-amber-500" />
                                  : <Star className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setExpandedId(expandedId === r.resume_id ? null : r.resume_id)}
                                className="p-1 rounded transition-all"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {expandedId === r.resume_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setSelectedEntry(r)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-500 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                              >
                                View
                              </button>
                            </div>
                          </div>

                          {/* Mini score bars */}
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {[
                              { label: 'Skills', value: r.skill_match_score, color: '#8b5cf6' },
                              { label: 'Semantic', value: r.semantic_similarity, color: '#0ea5e9' },
                              { label: 'Overall', value: r.score, color: '#10b981' },
                            ].map(({ label, value, color }) => (
                              <div key={label}>
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{Math.round(value || 0)}%</span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${value || 0}%`, backgroundColor: color }} />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Skills row */}
                          <div className="flex flex-wrap gap-1">
                            {r.matched_skills?.slice(0, 3).map(s => <SkillBadge key={s} skill={s} variant="matched" />)}
                            {r.missing_skills?.slice(0, 2).map(s => <SkillBadge key={s} skill={s} variant="missing" />)}
                          </div>

                          {/* Expanded notes */}
                          <AnimatePresence>
                            {expandedId === r.resume_id && r.notes && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 overflow-hidden"
                              >
                                <div className="p-2 rounded-lg text-xs italic" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                  "{r.notes}"
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="flex-shrink-0">
                          <ScoreRing score={r.score || 0} size={60} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Candidate detail modal */}
      <AnimatePresence>
        {selectedEntry && (
          <CandidateDetail
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onToggleShortlist={handleToggleShortlist}
            onSaveNotes={handleSaveNotes}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
