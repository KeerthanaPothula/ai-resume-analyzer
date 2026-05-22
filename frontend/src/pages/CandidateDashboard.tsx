import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, FileText, TrendingUp, Star, Plus, Trash2, Eye } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import StatsCard from '../components/ui/StatsCard';
import SkillBadge from '../components/ui/SkillBadge';
import ScoreRing from '../components/ui/ScoreRing';
import { resumeApi } from '../lib/api';
import { Resume } from '../types';
import { useAuth } from '../hooks/useAuth';

export default function CandidateDashboard() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    resumeApi.list().then((r) => setResumes(r.data)).catch(() => toast.error('Failed to load resumes')).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await resumeApi.delete(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
      toast.success('Resume deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const avgScore = resumes.length ? resumes.reduce((a, r) => a + (r.ats_score || 0), 0) / resumes.length : 0;
  const allSkills = [...new Set(resumes.flatMap((r) => r.extracted_skills || []))];

  const skillChartData = allSkills.slice(0, 6).map((skill) => ({
    skill: skill.slice(0, 10),
    count: resumes.filter((r) => r.extracted_skills?.includes(skill)).length,
  }));

  const radarData = [
    { subject: 'Skills', A: Math.min(100, allSkills.length * 5) },
    { subject: 'Experience', A: Math.min(100, (resumes[0]?.experience_years || 0) * 10) },
    { subject: 'ATS Score', A: avgScore },
    { subject: 'Education', A: resumes[0]?.education_level === "Master's" ? 90 : resumes[0]?.education_level === "Bachelor's" ? 70 : 50 },
    { subject: 'Profile', A: resumes.length > 0 ? 80 : 20 },
  ];

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
            <p className="text-slate-400 mt-1">Track your resume performance and AI insights</p>
          </div>
          <Link to="/upload" className="btn-primary">
            <Plus className="w-4 h-4" /> Upload Resume
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Resumes" value={resumes.length} icon={FileText} color="sky" delay={0} />
          <StatsCard title="Avg ATS Score" value={`${avgScore.toFixed(0)}%`} icon={TrendingUp} color="violet" delay={0.1} />
          <StatsCard title="Total Skills" value={allSkills.length} icon={Star} color="emerald" delay={0.2} />
          <StatsCard title="Experience" value={`${resumes[0]?.experience_years?.toFixed(0) || 0} yrs`} icon={Upload} color="amber" delay={0.3} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Radar Chart */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Profile Overview</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Radar name="Profile" dataKey="A" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Skill Chart */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Top Skills</h3>
            {skillChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={skillChartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="skill" type="category" width={80} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {skillChartData.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? '#0ea5e9' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">Upload a resume to see skills</div>
            )}
          </div>

          {/* Score rings */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">ATS Score</h3>
            <div className="flex items-center justify-center h-[220px]">
              {resumes.length > 0 ? (
                <ScoreRing score={avgScore} size={160} label="Average Score" />
              ) : (
                <div className="text-center text-slate-500 text-sm">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No resumes yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resumes list */}
        <div className="card">
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">My Resumes</h3>
            <Link to="/upload" className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add New
            </Link>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : resumes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">No resumes uploaded yet</p>
              <p className="text-slate-500 text-sm mb-6">Upload your first resume to get started</p>
              <Link to="/upload" className="btn-primary justify-center inline-flex">
                <Upload className="w-4 h-4" /> Upload Resume
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {resumes.map((resume) => (
                <motion.div
                  key={resume.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-5 flex items-center gap-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{resume.original_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-slate-400 text-xs">{new Date(resume.created_at).toLocaleDateString()}</span>
                      {resume.candidate_name && <span className="text-slate-400 text-xs">{resume.candidate_name}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(resume.extracted_skills || []).slice(0, 4).map((skill) => (
                        <SkillBadge key={skill} skill={skill} />
                      ))}
                      {(resume.extracted_skills?.length || 0) > 4 && (
                        <span className="text-slate-500 text-xs">+{(resume.extracted_skills?.length || 0) - 4} more</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{(resume.ats_score || 0).toFixed(0)}</p>
                      <p className="text-slate-400 text-xs">ATS</p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/analysis/${resume.id}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(resume.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
