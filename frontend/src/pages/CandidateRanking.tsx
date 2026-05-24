import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Trophy, Users, Loader2, RefreshCw, Medal,
  Star, X, ChevronDown, ChevronUp,
  Briefcase, GraduationCap, MessageSquare, Check,
  BarChart3, Zap, SlidersHorizontal, HelpCircle,
  Calendar, Link2, ClipboardList, CheckCircle2,
  XCircle, Clock, Eye, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import SkillBadge from '../components/ui/SkillBadge';
import ScoreRing from '../components/ui/ScoreRing';
import EmptyState from '../components/ui/EmptyState';
import { jobApi, rankingApi } from '../lib/api';
import {
  JobDescription,
  ApplicationStatus, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_ORDER, RankingEntry,
} from '../types';
import { useThemeStore } from '../stores/themeStore';

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const c = APPLICATION_STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

// ── Status Dropdown ────────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange,
  disabled,
}: {
  current: ApplicationStatus;
  onChange: (s: ApplicationStatus) => void;
  disabled?: boolean;
}) {
  const c = APPLICATION_STATUS_COLORS[current];
  return (
    <select
      value={current}
      onChange={e => onChange(e.target.value as ApplicationStatus)}
      disabled={disabled}
      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer transition-all focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50 ${c.bg} ${c.text} ${c.border}`}
    >
      {APPLICATION_STATUS_ORDER.map(s => (
        <option key={s} value={s} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
          {APPLICATION_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────

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

// ── Candidate Detail Modal ─────────────────────────────────────────────────────

function CandidateDetail({
  entry,
  onClose,
  onUpdate,
}: {
  entry: RankingEntry;
  onClose: () => void;
  onUpdate: (rankingId: number, patch: Partial<RankingEntry>) => Promise<void>;
}) {
  const [status, setStatus] = useState<ApplicationStatus>(entry.application_status || 'applied');
  const [notes, setNotes] = useState(entry.recruiter_notes || '');
  const [interviewDate, setInterviewDate] = useState(
    entry.interview_date ? entry.interview_date.slice(0, 16) : ''
  );
  const [meetingLink, setMeetingLink] = useState(entry.meeting_link || '');
  const [instructions, setInstructions] = useState(entry.interview_instructions || '');
  const [saving, setSaving] = useState(false);

  const isDirty =
    status !== (entry.application_status || 'applied') ||
    notes !== (entry.recruiter_notes || '') ||
    interviewDate !== (entry.interview_date ? entry.interview_date.slice(0, 16) : '') ||
    meetingLink !== (entry.meeting_link || '') ||
    instructions !== (entry.interview_instructions || '');

  const handleSave = async () => {
    if (!entry.ranking_id) return;
    setSaving(true);
    await onUpdate(entry.ranking_id, {
      application_status: status,
      recruiter_notes: notes,
      interview_date: interviewDate ? new Date(interviewDate).toISOString() : null,
      meeting_link: meetingLink,
      interview_instructions: instructions,
      shortlisted: status === 'shortlisted' || status === 'interview_scheduled' || status === 'accepted',
    });
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-violet-500/30 transition-all";
  const inputStyle = { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
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
            <StatusBadge status={entry.application_status || 'applied'} />
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

          {/* ── Recruiter Controls ── */}
          <div className="card p-4 space-y-4 border-2 border-violet-500/20">
            <h4 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <ClipboardList className="w-3.5 h-3.5 text-violet-500" />
              Recruiter Actions
            </h4>

            {/* Status */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Application Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {APPLICATION_STATUS_ORDER.map(s => {
                  const c = APPLICATION_STATUS_COLORS[s];
                  const isSelected = status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                        isSelected ? `${c.bg} ${c.text} ${c.border} ring-1 ring-current` : 'hover:opacity-80'
                      }`}
                      style={isSelected ? {} : { borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                      {APPLICATION_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Recruiter Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this candidate…"
                rows={3}
                className={`${inputClass} resize-none`}
                style={inputStyle}
              />
            </div>

            {/* Interview scheduling */}
            {(status === 'interview_scheduled' || interviewDate) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 overflow-hidden"
              >
                <p className="text-xs font-medium text-violet-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Interview Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Date & Time</label>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={e => setInterviewDate(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Meeting Link</label>
                    <input
                      type="url"
                      value={meetingLink}
                      onChange={e => setMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/…"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Instructions for Candidate</label>
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Please prepare a 5-minute intro, bring your portfolio…"
                    rows={2}
                    className={`${inputClass} resize-none`}
                    style={inputStyle}
                  />
                </div>
              </motion.div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !isDirty || !entry.ranking_id}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Rank Badge ─────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const configs: Record<number, { bg: string; border: string; color: string }> = {
    1: { bg: 'bg-amber-500/15',  border: 'border-amber-500/40',  color: 'text-amber-500'  },
    2: { bg: 'bg-slate-400/15',  border: 'border-slate-400/40',  color: 'text-slate-400'  },
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
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'shortlisted' | 'interview_scheduled' | 'accepted'>('all');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
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

  const mapRow = (r: any): RankingEntry => ({
    ranking_id: r.ranking_id,
    rank: r.rank,
    score: r.score,
    application_status: (r.application_status || 'applied') as ApplicationStatus,
    shortlisted: r.shortlisted || false,
    notes: r.notes || '',
    recruiter_notes: r.recruiter_notes || '',
    interview_date: r.interview_date || null,
    meeting_link: r.meeting_link || '',
    interview_instructions: r.interview_instructions || '',
    updated_at: r.updated_at || null,
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
      const [jobRes, rankRes] = await Promise.all([
        jobApi.get(parseInt(jobId)),
        rankingApi.getForJob(parseInt(jobId)),
      ]);
      setJob(jobRes.data);
      setRankings(rankRes.data.map(mapRow));
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRankAll = async () => {
    if (!jobId || rankings.length === 0) return toast.error('No applicants to rank');
    setRanking(true);
    try {
      await rankingApi.rank(parseInt(jobId), rankings.map(r => r.resume_id));
      toast.success(`Re-ranked ${rankings.length} applicant${rankings.length !== 1 ? 's' : ''}!`);
      await loadData();
    } catch {
      toast.error('Ranking failed');
    } finally {
      setRanking(false);
    }
  };

  const handleUpdate = async (rankingId: number, patch: Partial<RankingEntry>) => {
    try {
      await rankingApi.updateEntry(rankingId, {
        shortlisted: patch.shortlisted,
        notes: patch.recruiter_notes,
        application_status: patch.application_status,
        interview_date: patch.interview_date ?? undefined,
        meeting_link: patch.meeting_link,
        interview_instructions: patch.interview_instructions,
      });
      setRankings(prev => prev.map(r => r.ranking_id === rankingId ? { ...r, ...patch } : r));
      if (selectedEntry?.ranking_id === rankingId) {
        setSelectedEntry(prev => prev ? { ...prev, ...patch } : null);
      }
      toast.success('Updated');
    } catch {
      toast.error('Failed to save changes');
    }
  };

  const handleQuickStatusChange = async (entry: RankingEntry, newStatus: ApplicationStatus) => {
    if (!entry.ranking_id) return;
    const newShortlisted = ['shortlisted', 'interview_scheduled', 'accepted'].includes(newStatus);
    await handleUpdate(entry.ranking_id, {
      application_status: newStatus,
      shortlisted: newShortlisted,
    });
  };

  const handleToggleShortlist = async (entry: RankingEntry) => {
    if (!entry.ranking_id) {
      toast.error('Save rankings first before shortlisting');
      return;
    }
    const newShortlisted = !entry.shortlisted;
    const newStatus: ApplicationStatus = newShortlisted ? 'shortlisted' : 'applied';
    await handleUpdate(entry.ranking_id, { shortlisted: newShortlisted, application_status: newStatus });
  };

  const shortlistedCount = rankings.filter(r => r.shortlisted).length;
  const interviewCount = rankings.filter(r => r.application_status === 'interview_scheduled').length;
  const acceptedCount = rankings.filter(r => r.application_status === 'accepted').length;
  const rejectedCount = rankings.filter(r => r.application_status === 'rejected').length;

  const filteredRankings = useMemo(() => {
    let list = [...rankings];
    if (statusFilter !== 'all') {
      list = list.filter(r => r.application_status === statusFilter);
    } else if (filter === 'shortlisted') {
      list = list.filter(r => r.shortlisted);
    } else if (filter === 'interview_scheduled') {
      list = list.filter(r => r.application_status === 'interview_scheduled');
    } else if (filter === 'accepted') {
      list = list.filter(r => r.application_status === 'accepted');
    }
    if (sortBy === 'skill') list.sort((a, b) => (b.skill_match_score || 0) - (a.skill_match_score || 0));
    else if (sortBy === 'semantic') list.sort((a, b) => (b.semantic_similarity || 0) - (a.semantic_similarity || 0));
    else list.sort((a, b) => (b.score || 0) - (a.score || 0));
    return list;
  }, [rankings, filter, statusFilter, sortBy]);

  const chartData = rankings
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(r => ({
      name: (r.candidate_name || `#${r.rank}`).split(' ')[0],
      score: parseFloat((r.score || 0).toFixed(1)),
      status: r.application_status,
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
                {job.company}{job.location && <span className="ml-2">· {job.location}</span>}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {rankings.length} applicant{rankings.length !== 1 ? 's' : ''} · {shortlistedCount} shortlisted · {interviewCount} interviewing · {acceptedCount} accepted
            </p>
          </div>
          {rankings.length > 0 && (
            <button
              onClick={handleRankAll}
              disabled={ranking}
              className="btn-primary self-start md:self-auto"
            >
              {ranking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {ranking ? 'Ranking…' : 'Re-rank Applicants'}
            </button>
          )}
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
              title="No applicants yet"
              description="No candidates have applied to this job. Applicants will appear here after they submit an application."
            />
          </div>
        ) : (
          <>
            {/* Hiring Funnel Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Shortlisted',  value: shortlistedCount, color: 'text-amber-500',   bg: 'bg-amber-500/10',   icon: Star         },
                { label: 'Interviewing', value: interviewCount,   color: 'text-violet-500',  bg: 'bg-violet-500/10',  icon: Calendar     },
                { label: 'Accepted',     value: acceptedCount,    color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                { label: 'Rejected',     value: rejectedCount,    color: 'text-red-400',     bg: 'bg-red-500/10',     icon: XCircle      },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className={`card p-4 flex items-center gap-3 ${bg}`}>
                  <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                  <div>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

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
                      {chartData.map((d, i) => {
                        const statusColors: Record<string, string> = {
                          accepted: '#10b981', shortlisted: '#f59e0b',
                          interview_scheduled: '#8b5cf6', rejected: '#ef4444',
                        };
                        return <Cell key={i} fill={statusColors[d.status] || (i === 0 ? '#8b5cf6' : '#0ea5e9')} />;
                      })}
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
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {r.candidate_name || `Candidate ${r.rank}`}
                            </p>
                            <StatusBadge status={r.application_status || 'applied'} />
                          </div>
                          <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${r.score}%`, backgroundColor: c }} />
                          </div>
                        </div>
                        <p className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                          {r.score?.toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filter + Sort bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                {([
                  ['all', `All (${rankings.length})`],
                  ['shortlisted', `Shortlisted (${shortlistedCount})`],
                  ['interview_scheduled', `Interviewing (${interviewCount})`],
                  ['accepted', `Accepted (${acceptedCount})`],
                ] as const).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as typeof filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      filter === f
                        ? 'bg-violet-500/15 text-violet-500 border-violet-500/30'
                        : 'hover:opacity-80'
                    }`}
                    style={{ borderColor: filter === f ? undefined : 'var(--border-color)', color: filter === f ? undefined : 'var(--text-secondary)' }}
                  >
                    {label}
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
                  No candidates match this filter.
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
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {r.candidate_name || `Candidate #${r.rank}`}
                              </p>
                              <StatusBadge status={r.application_status || 'applied'} />
                              {r.interview_date && (
                                <span className="flex items-center gap-1 text-xs text-violet-500">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(r.interview_date).toLocaleDateString()}
                                </span>
                              )}
                              {r.recruiter_notes && (
                                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {r.experience_years?.toFixed(0) || 0}y exp
                              </span>
                              {/* Quick status change */}
                              <StatusDropdown
                                current={r.application_status || 'applied'}
                                onChange={s => handleQuickStatusChange(r, s)}
                              />
                              <button
                                onClick={() => setExpandedId(expandedId === r.resume_id ? null : r.resume_id)}
                                className="p-1 rounded transition-all"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {expandedId === r.resume_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setSelectedEntry(r)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-500 border border-violet-500/20 hover:bg-violet-500/20 transition-all flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>
                            </div>
                          </div>

                          {/* Mini score bars */}
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {[
                              { label: 'Skills',   value: r.skill_match_score,  color: '#8b5cf6' },
                              { label: 'Semantic', value: r.semantic_similarity, color: '#0ea5e9' },
                              { label: 'Overall',  value: r.score,              color: '#10b981' },
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
                            {expandedId === r.resume_id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 overflow-hidden space-y-2"
                              >
                                {r.recruiter_notes && (
                                  <div className="p-2 rounded-lg text-xs italic" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                    <MessageSquare className="w-3 h-3 inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                                    "{r.recruiter_notes}"
                                  </div>
                                )}
                                {r.interview_date && (
                                  <div className="flex items-center gap-2 text-xs text-violet-500 px-2">
                                    <Calendar className="w-3 h-3" />
                                    Interview: {new Date(r.interview_date).toLocaleString()}
                                    {r.meeting_link && (
                                      <a href={r.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline ml-2">
                                        <Link2 className="w-3 h-3" /> Join
                                      </a>
                                    )}
                                  </div>
                                )}
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
            onUpdate={handleUpdate}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
