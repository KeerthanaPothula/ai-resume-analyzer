import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, FileText, Briefcase, BarChart3, Shield, Activity,
  TrendingUp, Award,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Layout from '../components/layout/Layout';
import StatsCard from '../components/ui/StatsCard';
import { resumeApi, jobApi } from '../lib/api';
import { useThemeStore } from '../stores/themeStore';
import api from '../lib/api';

interface UserRow {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_COLORS = { candidate: '#0ea5e9', recruiter: '#8b5cf6', admin: '#22c55e' };

export default function AdminDashboard() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [jobs, setJobs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/').catch(() => ({ data: [] })),
      resumeApi.list().catch(() => ({ data: [] })),
      jobApi.list().catch(() => ({ data: [] })),
    ]).then(([u, r, j]) => {
      setUsers(u.data);
      setResumes(r.data);
      setJobs(j.data);
    }).finally(() => setLoading(false));
  }, []);

  const roleData = [
    { name: 'Candidates', value: users.filter(u => u.role === 'candidate').length, color: ROLE_COLORS.candidate },
    { name: 'Recruiters', value: users.filter(u => u.role === 'recruiter').length, color: ROLE_COLORS.recruiter },
    { name: 'Admins',     value: users.filter(u => u.role === 'admin').length,     color: ROLE_COLORS.admin },
  ].filter(d => d.value > 0);

  const scoreData = resumes.slice(0, 10).map((r, i) => ({
    name: `R${i + 1}`,
    score: Math.round(r.ats_score ?? 0),
  }));

  const avgScore = resumes.length
    ? Math.round(resumes.reduce((a, r) => a + (r.ats_score ?? 0), 0) / resumes.length)
    : 0;

  const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  const tickColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  return (
    <Layout title="Admin Dashboard">
      <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Admin Dashboard
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Platform overview and system health
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 self-start sm:self-auto">
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span className="text-emerald-500 text-xs font-semibold">System Healthy</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Users"    value={users.length}   icon={Users}     color="sky"    delay={0}    />
          <StatsCard title="Total Resumes"  value={resumes.length} icon={FileText}  color="violet" delay={0.05} />
          <StatsCard title="Job Postings"   value={jobs.length}    icon={Briefcase} color="emerald" delay={0.1} />
          <StatsCard
            title="Avg ATS Score"
            value={`${avgScore}%`}
            icon={BarChart3}
            color="amber"
            delay={0.15}
          />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Role distribution */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              Users by Role
            </h3>
            {roleData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={160}>
                  <PieChart>
                    <Pie
                      data={roleData}
                      cx="50%" cy="50%"
                      innerRadius={44} outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {roleData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {roleData.map(d => (
                    <div key={d.name} className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No user data yet
              </div>
            )}
          </div>

          {/* ATS score trend */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              Resume ATS Score Trend
            </h3>
            {scoreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={scoreData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v}%`, 'ATS Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#0ea5e9"
                    fill="url(#scoreGrad)"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9', r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No resume data yet
              </div>
            )}
          </div>
        </div>

        {/* Activity summary */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Active Candidates',
                value: users.filter(u => u.role === 'candidate' && u.is_active).length,
                icon: Users,
                color: 'text-sky-500',
                bg: 'bg-sky-500/10',
              },
              {
                label: 'Active Recruiters',
                value: users.filter(u => u.role === 'recruiter' && u.is_active).length,
                icon: Briefcase,
                color: 'text-violet-500',
                bg: 'bg-violet-500/10',
              },
              {
                label: 'Top ATS Score',
                value: resumes.length ? `${Math.max(...resumes.map(r => r.ats_score ?? 0)).toFixed(0)}%` : '—',
                icon: Award,
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`card p-4 flex items-center gap-3`}>
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="card overflow-hidden">
          <div
            className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              All Users
            </h3>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)' }}
            >
              {users.length} total
            </span>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border-color)` }}>
                    {['Name', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="transition-colors"
                      style={{
                        borderBottom: `1px solid var(--border-color)`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {user.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                            {user.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {user.email}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge text-xs capitalize ${
                          user.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                            : user.role === 'recruiter'
                            ? 'bg-violet-500/10 text-violet-500 border border-violet-500/25'
                            : 'bg-sky-500/10 text-sky-500 border border-sky-500/25'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge text-xs ${
                          user.is_active
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                            : 'bg-red-500/10 text-red-400 border border-red-500/25'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No users found
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
