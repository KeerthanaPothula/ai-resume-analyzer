import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Phone, MapPin, BookOpen, Clock, CheckCircle, XCircle, MessageSquare, HelpCircle } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import ScoreRing from '../components/ui/ScoreRing';
import SkillBadge from '../components/ui/SkillBadge';
import { resumeApi } from '../lib/api';
import { Resume } from '../types';

export default function ResumeAnalysis() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resumeId) {
      resumeApi.get(parseInt(resumeId))
        .then((r) => setResume(r.data))
        .catch(() => toast.error('Failed to load resume'))
        .finally(() => setLoading(false));
    }
  }, [resumeId]);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!resume) return (
    <Layout>
      <div className="p-8 text-center text-slate-400">Resume not found</div>
    </Layout>
  );

  const radarData = [
    { subject: 'Skills', A: Math.min(100, (resume.extracted_skills?.length || 0) * 5) },
    { subject: 'Experience', A: Math.min(100, (resume.experience_years || 0) * 10) },
    { subject: 'ATS Score', A: resume.ats_score || 0 },
    { subject: 'Education', A: resume.education_level === "Master's" ? 90 : resume.education_level === "Bachelor's" ? 70 : 50 },
    { subject: 'Profile', A: 75 },
  ];

  const scoreColor = (resume.ats_score || 0) >= 80 ? 'text-emerald-400' : (resume.ats_score || 0) >= 60 ? 'text-sky-400' : (resume.ats_score || 0) >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
        {/* Back */}
        <Link to="/candidate" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {(resume.candidate_name || resume.original_name)?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{resume.candidate_name || 'Resume Analysis'}</h1>
            <p className="text-slate-400">{resume.original_name}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
              {resume.candidate_email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{resume.candidate_email}</span>}
              {resume.candidate_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{resume.candidate_phone}</span>}
              {resume.candidate_location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{resume.candidate_location}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-extrabold ${scoreColor}`}>{(resume.ats_score || 0).toFixed(0)}</p>
            <p className="text-slate-400 text-sm">ATS Score</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Score Ring */}
          <div className="card p-6 flex flex-col items-center gap-4">
            <h3 className="text-white font-semibold self-start">Overall Score</h3>
            <ScoreRing score={resume.ats_score || 0} size={150} />
            <div className="grid grid-cols-2 gap-3 w-full text-sm">
              <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                <Clock className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <p className="text-white font-medium">{resume.experience_years?.toFixed(0) || 0} yrs</p>
                <p className="text-slate-400 text-xs">Experience</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                <BookOpen className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                <p className="text-white font-medium text-xs">{resume.education_level || 'N/A'}</p>
                <p className="text-slate-400 text-xs">Education</p>
              </div>
            </div>
          </div>

          {/* Radar */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Profile Radar</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Radar dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Info */}
          <div className="card p-6 space-y-4">
            <h3 className="text-white font-semibold">Candidate Info</h3>
            {[
              { icon: User, label: 'Name', value: resume.candidate_name || 'Not detected' },
              { icon: Mail, label: 'Email', value: resume.candidate_email || 'Not detected' },
              { icon: Clock, label: 'Experience', value: `${resume.experience_years?.toFixed(0) || 0} years` },
              { icon: BookOpen, label: 'Education', value: resume.education_level || 'Not specified' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">{label}</p>
                  <p className="text-white text-sm font-medium truncate max-w-[180px]">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white font-semibold">Extracted Skills ({resume.extracted_skills?.length || 0})</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(resume.extracted_skills || []).map((skill) => (
                <SkillBadge key={skill} skill={skill} variant="matched" />
              ))}
              {(!resume.extracted_skills || resume.extracted_skills.length === 0) && (
                <p className="text-slate-500 text-sm">No skills detected</p>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-semibold">Strengths</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(resume.strengths || []).map((s) => (
                <SkillBadge key={s} skill={s} variant="neutral" />
              ))}
              {(!resume.strengths || resume.strengths.length === 0) && (
                <p className="text-slate-500 text-sm">Analyzing...</p>
              )}
            </div>
          </div>
        </div>

        {/* AI Feedback */}
        {resume.ai_feedback && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-sky-400" />
              <h3 className="text-white font-semibold">AI Feedback</h3>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">
                {resume.ai_feedback}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
