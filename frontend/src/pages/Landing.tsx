import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Zap, Target, BarChart3, Users, Shield, ArrowRight,
  CheckCircle, Sparkles, MessageSquare, FileSearch, TrendingUp,
  Star, ChevronRight, Cpu, Lock, Globe,
} from 'lucide-react';

/* ── Animation helpers ─────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

/* ── Data ──────────────────────────────────────────────────────────────── */
const features = [
  {
    icon: Brain,
    title: 'AI-Powered Parsing',
    desc: 'Extract skills, experience, and education from any resume format in under 2 seconds.',
    color: 'sky',
    gradient: 'from-sky-500/20 to-sky-600/10',
    border: 'border-sky-500/25',
  },
  {
    icon: Target,
    title: 'ATS Score Engine',
    desc: 'Real-time scoring against job descriptions with detailed skill gap analysis.',
    color: 'violet',
    gradient: 'from-violet-500/20 to-violet-600/10',
    border: 'border-violet-500/25',
  },
  {
    icon: FileSearch,
    title: 'Job Match Analysis',
    desc: 'Paste any job description and get an instant AI match score with improvement tips.',
    color: 'emerald',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/25',
  },
  {
    icon: MessageSquare,
    title: 'AI Career Coach',
    desc: 'Chat with an AI coach trained on thousands of successful job applications.',
    color: 'amber',
    gradient: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/25',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    desc: 'Radar charts, skill trends, and ATS score breakdowns to track progress.',
    color: 'rose',
    gradient: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/25',
  },
  {
    icon: Users,
    title: 'Candidate Ranking',
    desc: 'Recruiters rank all candidates by AI score with side-by-side comparison.',
    color: 'indigo',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/25',
  },
];

const stats = [
  { value: '95%', label: 'ATS Accuracy', icon: Target },
  { value: '<2s', label: 'Parse Time',   icon: Zap    },
  { value: '500+', label: 'Skill Keywords', icon: Brain },
  { value: 'Free', label: 'To Start',    icon: Star   },
];

const roles = [
  {
    role: 'Candidate',
    tagline: 'Land your dream role faster',
    color: 'sky',
    icon: TrendingUp,
    items: [
      'Upload & AI-parse any resume format',
      'Get real-time ATS score with gaps',
      'Paste job descriptions for instant match',
      'Chat with AI career coach',
      'Interview prep questions per role',
    ],
  },
  {
    role: 'Recruiter',
    tagline: 'Find the best candidates instantly',
    color: 'violet',
    icon: Users,
    items: [
      'Post job descriptions with skill requirements',
      'AI rank all applicants by fit score',
      'Semantic skill matching beyond keywords',
      'Side-by-side candidate comparison',
      'Export shortlists and reports',
    ],
  },
  {
    role: 'Admin',
    tagline: 'Full platform visibility',
    color: 'emerald',
    icon: Shield,
    items: [
      'Manage users across all roles',
      'Platform-wide analytics dashboard',
      'AI usage and performance metrics',
      'System configuration & oversight',
    ],
  },
];

const trustItems = [
  { icon: Lock,  label: 'JWT Auth & Role-Based Access' },
  { icon: Cpu,   label: 'Gemini AI + OpenAI Support'   },
  { icon: Globe, label: 'REST API · FastAPI Backend'    },
  { icon: Shield, label: 'Rate Limiting · CORS Protected' },
];

/* ── Component ─────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-800/50"
        style={{ backgroundColor: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm leading-none block">Resume AI</span>
              <span className="text-[10px] text-slate-500">Intelligence Platform</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors px-4 py-2 rounded-lg hover:bg-slate-800">
              Sign In
            </Link>
            <Link to="/register" className="btn-primary text-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden bg-grid">
        {/* Orb background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb w-[700px] h-[700px] bg-sky-500/8 -top-40 -left-40" />
          <div className="orb w-[600px] h-[600px] bg-violet-500/8 top-20 -right-40" />
          <div className="orb w-[400px] h-[400px] bg-emerald-500/5 bottom-0 left-1/2 -translate-x-1/2" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div {...fadeUp(0.1)}>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-400 text-xs font-semibold mb-8 tracking-wide uppercase">
              <Sparkles className="w-3 h-3" /> AI-Powered Resume Intelligence
            </span>
          </motion.div>

          <motion.h1 {...fadeUp(0.18)} className="text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight">
            Land Your Dream Job
            <br />
            <span className="gradient-text">with AI Precision</span>
          </motion.h1>

          <motion.p {...fadeUp(0.26)} className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Parse resumes in seconds, score candidates with semantic AI,
            and get personalized coaching — all in one platform built for modern hiring.
          </motion.p>

          <motion.div {...fadeUp(0.34)} className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/register"
              className="btn-primary text-base px-8 py-3 justify-center shadow-xl shadow-sky-500/20">
              Start for Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login"
              className="btn-secondary text-base px-8 py-3 justify-center border-slate-700 text-slate-300 hover:border-sky-500/40 hover:text-white">
              Sign In
            </Link>
          </motion.div>

          {/* Floating UI preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto"
          >
            <div className="card-glass p-5 rounded-2xl border border-white/8 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 text-slate-500 text-xs font-mono">resume-analysis.ai</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'ATS Score', value: '87%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Skills Match', value: '12/15', color: 'text-sky-400', bg: 'bg-sky-500/10' },
                  { label: 'Job Match', value: '91%', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center border border-white/5`}>
                    <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5 font-medium">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-xl bg-sky-500/8 border border-sky-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span className="text-xs font-semibold text-sky-300">AI Recommendation</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Strong match for Senior Engineer roles. Add Docker & Kubernetes to skills section to increase ATS score by ~8 points.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="py-14 px-6 border-y border-slate-800/50 bg-slate-900/30">
        <div className="max-w-4xl mx-auto">
          <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ value, label, icon: Icon }) => (
              <motion.div key={label} variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
                className="text-center group">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-sky-400" />
                </div>
                <p className="text-3xl font-extrabold gradient-text mb-1">{value}</p>
                <p className="text-slate-500 text-sm">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-white mb-4">Everything You Need to Get Hired</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              A complete AI hiring platform — from resume parsing to interview prep.
            </p>
          </motion.div>

          <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc, color, gradient, border }) => (
              <motion.div key={title}
                variants={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}
                className={`group relative bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-6
                  hover:shadow-xl hover:shadow-${color}-500/10 hover:-translate-y-1 transition-all duration-300`}>
                <div className={`w-11 h-11 rounded-xl bg-${color}-500/15 border border-${color}-500/30
                  flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 text-${color}-400`} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                <div className={`absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <ChevronRight className={`w-4 h-4 text-${color}-400`} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Roles ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-900/40 relative overflow-hidden">
        <div className="orb w-[500px] h-[500px] bg-violet-500/6 top-0 right-0 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUp()} className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Roles</p>
            <h2 className="text-4xl font-bold text-white mb-4">Built for Every Stakeholder</h2>
            <p className="text-slate-400 text-lg">Role-specific dashboards with the right tools for each user type.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {roles.map(({ role, tagline, color, icon: Icon, items }, i) => (
              <motion.div key={role} {...fadeUp(i * 0.1)}
                className={`relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-7
                  hover:border-${color}-500/30 hover:shadow-xl hover:shadow-${color}-500/8 transition-all duration-300`}>
                <div className={`w-12 h-12 rounded-2xl bg-${color}-500/15 border border-${color}-500/25
                  flex items-center justify-center mb-5`}>
                  <Icon className={`w-6 h-6 text-${color}-400`} />
                </div>
                <p className={`text-${color}-400 text-xs font-bold uppercase tracking-widest mb-1`}>{role}</p>
                <h3 className="text-white font-bold text-xl mb-4">{tagline}</h3>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <CheckCircle className={`w-4 h-4 text-${color}-400 flex-shrink-0 mt-0.5`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`mt-6 flex items-center gap-1.5 text-${color}-400 text-sm font-semibold
                    hover:text-${color}-300 transition-colors group`}>
                  Get started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────────────────── */}
      <section className="py-12 px-6 border-y border-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-slate-600 text-xs font-semibold uppercase tracking-widest mb-8">
            Built on production-grade technology
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-slate-500 text-sm">
                <Icon className="w-4 h-4 text-slate-600" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="orb w-[600px] h-[400px] bg-sky-500/8 top-0 left-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <motion.div {...fadeUp()}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-8">
              <CheckCircle className="w-3 h-3" /> No credit card required
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
              Ready to Transform
              <br />
              <span className="gradient-text">Your Hiring Process?</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Join candidates getting hired faster and recruiters finding top talent smarter.
              Start free in 30 seconds.
            </p>
            <Link to="/register"
              className="btn-primary text-base px-10 py-3.5 justify-center inline-flex shadow-2xl shadow-sky-500/25">
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-white">Resume AI</span>
            <span className="text-slate-600 text-sm ml-2">© 2024</span>
          </div>
          <div className="flex items-center gap-6 text-slate-500 text-sm">
            <Link to="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-slate-300 transition-colors">Register</Link>
          </div>
          <p className="text-slate-600 text-xs">
            Built with FastAPI · React · Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
}
