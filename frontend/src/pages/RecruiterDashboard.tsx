import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Plus, Users, BarChart3, Trash2, ChevronRight, MapPin, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import StatsCard from '../components/ui/StatsCard';
import SkillBadge from '../components/ui/SkillBadge';
import { jobApi } from '../lib/api';
import { JobDescription } from '../types';
import { useAuth } from '../hooks/useAuth';

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    jobApi.list().then((r) => setJobs(r.data)).catch(() => toast.error('Failed to load jobs')).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await jobApi.delete(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success('Job deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const totalSkills = [...new Set(jobs.flatMap((j) => j.required_skills || []))].length;

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Recruiter Dashboard</h1>
            <p className="text-slate-400 mt-1">Manage job postings and rank candidates</p>
          </div>
          <Link to="/jobs/create" className="btn-primary">
            <Plus className="w-4 h-4" /> Post a Job
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Active Jobs" value={jobs.length} icon={Briefcase} color="sky" delay={0} />
          <StatsCard title="Unique Skills" value={totalSkills} icon={BarChart3} color="violet" delay={0.1} />
          <StatsCard title="Posted by" value={user?.full_name?.split(' ')[0] || 'You'} icon={Users} color="emerald" delay={0.2} />
          <StatsCard title="This Month" value={jobs.filter(j => new Date(j.created_at).getMonth() === new Date().getMonth()).length} icon={Clock} color="amber" delay={0.3} />
        </div>

        {/* Jobs list */}
        <div className="card">
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Job Postings</h3>
            <Link to="/jobs/create" className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Create New
            </Link>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">No jobs posted yet</p>
              <p className="text-slate-500 text-sm mb-6">Create your first job posting to start ranking candidates</p>
              <Link to="/jobs/create" className="btn-primary justify-center inline-flex">
                <Plus className="w-4 h-4" /> Post a Job
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {jobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{job.title}</p>
                          <div className="flex items-center gap-3 text-slate-400 text-xs">
                            {job.company && <span>{job.company}</span>}
                            {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm line-clamp-2 mt-2 ml-12">{job.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
                        {(job.required_skills || []).slice(0, 5).map((skill) => (
                          <SkillBadge key={skill} skill={skill} />
                        ))}
                        {(job.required_skills?.length || 0) > 5 && (
                          <span className="text-slate-500 text-xs self-center">+{(job.required_skills?.length || 0) - 5} more</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/ranking/${job.id}`}
                        className="btn-secondary text-sm px-3 py-1.5"
                      >
                        Rank Candidates <ChevronRight className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(job.id)}
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
