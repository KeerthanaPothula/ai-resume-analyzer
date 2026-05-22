import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users, Loader2, RefreshCw, Medal, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import SkillBadge from '../components/ui/SkillBadge';
import ScoreRing from '../components/ui/ScoreRing';
import { jobApi, resumeApi, rankingApi } from '../lib/api';
import { JobDescription, Resume, RankingEntry } from '../types';

export default function CandidateRanking() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDescription | null>(null);
  const [allResumes, setAllResumes] = useState<Resume[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(false);
  const [selectedResume, setSelectedResume] = useState<number | null>(null);

  useEffect(() => {
    if (!jobId) return;
    Promise.all([
      jobApi.get(parseInt(jobId)),
      resumeApi.list(),
      rankingApi.getForJob(parseInt(jobId)),
    ])
      .then(([jobRes, resumesRes, rankRes]) => {
        setJob(jobRes.data);
        setAllResumes(resumesRes.data);
        if (rankRes.data.length) {
          setRankings(rankRes.data.map((r: any) => ({
            rank: r.rank,
            score: r.score,
            resume_id: r.resume?.id,
            candidate_name: r.resume?.candidate_name,
            candidate_email: r.resume?.candidate_email,
            skills: r.resume?.extracted_skills || [],
            experience_years: r.resume?.experience_years,
            education_level: r.resume?.education_level,
            matched_skills: r.ats_score?.matched_skills || [],
            missing_skills: r.ats_score?.missing_skills || [],
            skill_match_score: r.ats_score?.skill_match_score || 0,
            semantic_similarity: r.ats_score?.semantic_similarity || 0,
          })));
        }
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleRankAll = async () => {
    if (!jobId || allResumes.length === 0) return toast.error('No resumes to rank');
    setRanking(true);
    try {
      const res = await rankingApi.rank(parseInt(jobId), allResumes.map((r) => r.id));
      setRankings(res.data.rankings);
      toast.success(`Ranked ${res.data.total_candidates} candidates!`);
    } catch {
      toast.error('Ranking failed');
    } finally {
      setRanking(false);
    }
  };

  const chartData = rankings.slice(0, 10).map((r) => ({
    name: (r.candidate_name || `Candidate ${r.rank}`).split(' ')[0],
    score: parseFloat(r.score?.toFixed(1) || '0'),
  }));

  const rankColors = ['#f59e0b', '#9ca3af', '#cd7c2f'];

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
        <Link to="/recruiter" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{job?.title || 'Candidate Ranking'}</h1>
            {job?.company && <p className="text-slate-400">{job.company} {job.location && `• ${job.location}`}</p>}
            <p className="text-slate-500 text-sm mt-1">{allResumes.length} resumes available</p>
          </div>
          <button
            onClick={handleRankAll}
            disabled={ranking || allResumes.length === 0}
            className="btn-primary"
          >
            {ranking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {ranking ? 'Ranking...' : rankings.length ? 'Re-rank All' : 'Rank Candidates'}
          </button>
        </div>

        {rankings.length === 0 ? (
          <div className="card p-16 text-center">
            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium text-lg">No rankings yet</p>
            <p className="text-slate-500 text-sm mb-6">Click "Rank Candidates" to score and rank all available resumes against this job.</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card p-6">
                <h3 className="text-white font-semibold mb-4">Score Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: any) => [`${value}%`, 'Score']}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7c2f' : '#0ea5e9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="text-white font-semibold mb-4">Top 3 Candidates</h3>
                <div className="space-y-3">
                  {rankings.slice(0, 3).map((r, i) => (
                    <div key={r.resume_id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0`}
                        style={{ background: `${rankColors[i]}20`, border: `1px solid ${rankColors[i]}40`, color: rankColors[i] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{r.candidate_name || `Candidate ${r.rank}`}</p>
                        <div className="progress-bar mt-1">
                          <div className="progress-bar-fill" style={{ width: `${r.score}%` }} />
                        </div>
                      </div>
                      <p className="text-white font-bold text-sm">{r.score?.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Full ranking table */}
            <div className="card">
              <div className="p-6 border-b border-slate-700/50">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Full Rankings ({rankings.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {rankings.map((r, i) => (
                  <motion.div
                    key={r.resume_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="p-5 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank badge */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        r.rank === 1 ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' :
                        r.rank === 2 ? 'bg-slate-400/20 border border-slate-400/40 text-slate-300' :
                        r.rank === 3 ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400' :
                        'bg-slate-700/50 border border-slate-600 text-slate-400'
                      }`}>
                        {r.rank <= 3 ? <Medal className="w-4 h-4" /> : `#${r.rank}`}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white font-semibold">{r.candidate_name || `Candidate #${r.rank}`}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400">{r.experience_years?.toFixed(0) || 0} yrs exp</span>
                            <span className="text-slate-400">{r.education_level || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Score bars */}
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          {[
                            { label: 'Skill Match', value: r.skill_match_score },
                            { label: 'Semantic', value: r.semantic_similarity },
                            { label: 'Overall', value: r.score },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">{label}</span>
                                <span className="text-slate-300">{value?.toFixed(0)}%</span>
                              </div>
                              <div className="progress-bar">
                                <div className="progress-bar-fill" style={{ width: `${value || 0}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {r.matched_skills?.slice(0, 4).map((s) => <SkillBadge key={s} skill={s} variant="matched" />)}
                          {r.missing_skills?.slice(0, 3).map((s) => <SkillBadge key={s} skill={s} variant="missing" />)}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <ScoreRing score={r.score || 0} size={70} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
