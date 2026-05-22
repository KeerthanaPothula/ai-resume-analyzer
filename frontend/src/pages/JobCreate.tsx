import { useState, FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Plus, X, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { jobApi } from '../lib/api';

export default function JobCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    description: '',
    required_skills: [] as string[],
    preferred_skills: [] as string[],
    experience_required: 0,
    education_required: '',
  });

  const addSkill = (skill: string) => {
    const s = skill.trim().toLowerCase();
    if (s && !form.required_skills.includes(s)) {
      setForm({ ...form, required_skills: [...form.required_skills, s] });
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setForm({ ...form, required_skills: form.required_skills.filter((s) => s !== skill) });
  };

  const handleSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) return toast.error('Title and description are required');
    setLoading(true);
    try {
      const res = await jobApi.create(form);
      toast.success('Job posted!');
      navigate(`/ranking/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <button
          onClick={() => navigate('/recruiter')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Post a Job</h1>
          <p className="text-slate-400 mt-1">Create a job description to start ranking candidates with AI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-6 space-y-5">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-violet-400" />
              Job Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Job Title *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Senior Software Engineer"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Company</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Acme Corp"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="San Francisco, CA"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Experience Required (years)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  className="input"
                  value={form.experience_required}
                  onChange={(e) => setForm({ ...form, experience_required: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Education Required</label>
                <select
                  className="input"
                  value={form.education_required}
                  onChange={(e) => setForm({ ...form, education_required: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="High School">High School</option>
                  <option value="Associate/Diploma">Associate / Diploma</option>
                  <option value="Bachelor's">Bachelor's Degree</option>
                  <option value="Master's">Master's Degree</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Job Description *</label>
              <textarea
                className="input min-h-[180px] resize-none"
                placeholder="Describe the role, responsibilities, and requirements..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {/* Skills */}
          <div className="card p-6 space-y-4">
            <h3 className="text-white font-semibold">Required Skills</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add skill (press Enter or comma)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKey}
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="btn-secondary px-3"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.required_skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm"
                  >
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No skills added yet. AI will extract them from the description.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-3">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Briefcase className="w-5 h-5" /> Post Job & Rank Candidates</>}
            </button>
            <button type="button" onClick={() => navigate('/recruiter')} className="btn-secondary px-6">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
