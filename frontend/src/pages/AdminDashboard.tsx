import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Briefcase, BarChart3, Shield, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import StatsCard from '../components/ui/StatsCard';
import { resumeApi, jobApi } from '../lib/api';
import api from '../lib/api';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/').catch(() => ({ data: [] })),
      resumeApi.list().catch(() => ({ data: [] })),
      jobApi.list().catch(() => ({ data: [] })),
    ]).then(([usersRes, resumesRes, jobsRes]) => {
      setUsers(usersRes.data);
      setResumes(resumesRes.data);
      setJobs(jobsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const roleData = [
    { name: 'Candidates', value: users.filter((u) => u.role === 'candidate').length, color: '#0ea5e9' },
    { name: 'Recruiters', value: users.filter((u) => u.role === 'recruiter').length, color: '#8b5cf6' },
    { name: 'Admins', value: users.filter((u) => u.role === 'admin').length, color: '#22c55e' },
  ].filter((d) => d.value > 0);

  const scoreData = resumes.map((r, i) => ({
    name: `R${i + 1}`,
    score: r.ats_score?.toFixed(0) || 0,
  })).slice(0, 10);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-400" />
              Admin Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Platform overview and system health</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">System Healthy</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Users" value={users.length} icon={Users} color="sky" delay={0} />
          <StatsCard title="Total Resumes" value={resumes.length} icon={FileText} color="violet" delay={0.1} />
          <StatsCard title="Job Postings" value={jobs.length} icon={Briefcase} color="emerald" delay={0.2} />
          <StatsCard
            title="Avg ATS Score"
            value={resumes.length ? `${(resumes.reduce((a, r) => a + (r.ats_score || 0), 0) / resumes.length).toFixed(0)}%` : '0%'}
            icon={BarChart3}
            color="amber"
            delay={0.3}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Users by role */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Users by Role</h3>
            {roleData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {roleData.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-300 text-sm">{d.name}</span>
                      <span className="text-white font-bold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">No user data</div>
            )}
          </div>

          {/* Resume scores */}
          <div className="card p-6">
            <h3 className="text-white font-semibold mb-4">Resume ATS Scores</h3>
            {scoreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={scoreData}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="score" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">No resume data</div>
            )}
          </div>
        </div>

        {/* Users table */}
        <div className="card">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-white font-semibold text-lg">All Users</h3>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left p-4 text-slate-400 font-medium">Name</th>
                    <th className="text-left p-4 text-slate-400 font-medium">Email</th>
                    <th className="text-left p-4 text-slate-400 font-medium">Role</th>
                    <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left p-4 text-slate-400 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user.full_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-white font-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{user.email}</td>
                      <td className="p-4">
                        <span className={`badge capitalize ${
                          user.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          user.role === 'recruiter' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
                          'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`badge ${user.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{new Date(user.created_at).toLocaleDateString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-8 text-center text-slate-500">No users found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
