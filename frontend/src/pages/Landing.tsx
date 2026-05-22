import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Zap, Target, BarChart3, Users, Shield, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  { icon: Brain, title: 'AI-Powered Parsing', desc: 'Automatically extract skills, experience, and education from any resume format.' },
  { icon: Target, title: 'ATS Scoring', desc: 'Score resumes against job descriptions with our intelligent matching engine.' },
  { icon: Zap, title: 'Semantic Matching', desc: 'Go beyond keywords with sentence-transformer based semantic similarity.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Visualize candidate data with rich interactive charts and insights.' },
  { icon: Users, title: 'Candidate Ranking', desc: 'Rank and compare candidates side by side for any job opening.' },
  { icon: Shield, title: 'Role-Based Access', desc: 'Separate dashboards for candidates, recruiters, and admins.' },
];

const stats = [
  { value: '95%', label: 'ATS Accuracy' },
  { value: '<2s', label: 'Parse Time' },
  { value: '500+', label: 'Skill Keywords' },
  { value: '3 Roles', label: 'Access Levels' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Resume AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link to="/register" className="btn-primary text-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" /> AI-Powered Resume Intelligence
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
              Hire Smarter with{' '}
              <span className="gradient-text">AI Resume Analysis</span>
            </h1>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Automatically parse resumes, score candidates against job descriptions, and rank applicants using state-of-the-art AI and semantic matching.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="btn-primary text-base px-8 py-3 justify-center">
                Start for Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-8 py-3 justify-center">
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-slate-800/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-4xl font-extrabold gradient-text">{stat.value}</p>
              <p className="text-slate-400 text-sm mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Everything You Need</h2>
            <p className="text-slate-400 text-lg">A complete platform for modern talent acquisition</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="card p-6 hover:border-sky-500/40 transition-all duration-300 hover:glow-blue group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-sky-400" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Built for Every Role</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { role: 'Candidate', color: 'sky', items: ['Upload & parse resumes', 'View ATS scores', 'Get AI feedback', 'Track applications'] },
              { role: 'Recruiter', color: 'violet', items: ['Post job descriptions', 'Rank candidates', 'Semantic matching', 'Skill gap analysis'] },
              { role: 'Admin', color: 'emerald', items: ['Manage all users', 'View all data', 'Platform analytics', 'System oversight'] },
            ].map(({ role, color, items }) => (
              <div key={role} className={`card p-6 border-${color}-500/30 bg-${color}-500/5`}>
                <h3 className={`text-${color}-400 font-bold text-xl mb-4`}>{role}</h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                      <CheckCircle className={`w-4 h-4 text-${color}-400 flex-shrink-0`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Hiring?</h2>
          <p className="text-slate-400 mb-8">Join today and experience AI-powered resume intelligence.</p>
          <Link to="/register" className="btn-primary text-base px-10 py-3 justify-center inline-flex">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 px-6 text-center text-slate-500 text-sm">
        © 2024 AI Resume Intelligence Platform. Built with FastAPI, React & ❤️
      </footer>
    </div>
  );
}
