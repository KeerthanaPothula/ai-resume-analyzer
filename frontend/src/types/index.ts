export type UserRole = 'candidate' | 'recruiter' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Resume {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  file_type: string;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_location: string | null;
  extracted_skills: string[];
  experience_years: number;
  education_level: string | null;
  ats_score: number;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  ai_feedback: string | null;
  created_at: string;
}

export interface JobDescription {
  id: number;
  recruiter_id: number;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_required: number;
  education_required: string | null;
  created_at: string;
}

export interface CandidatePoolEntry {
  user_id: number;
  resume_id: number;
  candidate_name: string;
  candidate_email: string;
  ats_score: number;
  extracted_skills: string[];
  experience_years: number;
  education_level: string | null;
  original_name: string;
  created_at: string;
}

export interface ATSScore {
  id: number;
  resume_id: number;
  job_id: number;
  overall_score: number;
  skill_match_score: number;
  experience_score: number;
  education_score: number;
  semantic_similarity: number;
  matched_skills: string[];
  missing_skills: string[];
  skill_gap_analysis: {
    gap_percentage: number;
    critical_missing: string[];
    recommendations: Array<{ skill: string; priority: string; recommendation: string }>;
    overall_assessment: string;
  };
  interview_questions: string[];
  created_at: string;
}

export interface AIFeedback {
  provider: string;
  summary: string;
  improvement_suggestions: string[];
  missing_skills: string[];
  ats_optimization_tips: string[];
  overall_assessment: string;
  interview_questions: string[];
}

export interface JobMatchFeedback {
  provider: string;
  match_analysis: string;
  missing_skills: string[];
  interview_questions: string[];
  ats_tips: string[];
  recommendation: string;
}

export interface LLMStatus {
  available: boolean;
  provider: string;
}

export interface QuickMatchResult {
  provider: string;
  match_score: number;
  match_analysis: string;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  growth_areas: string[];
  interview_questions: string[];
  ats_tips: string[];
  recommendation: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Application Tracking ──────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'rejected'
  | 'accepted';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  rejected: 'Rejected',
  accepted: 'Accepted',
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, {
  bg: string;
  text: string;
  border: string;
  dot: string;
}> = {
  applied:              { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/25',  dot: 'bg-slate-400'   },
  under_review:         { bg: 'bg-sky-500/10',     text: 'text-sky-500',     border: 'border-sky-500/25',    dot: 'bg-sky-500'     },
  shortlisted:          { bg: 'bg-amber-500/10',   text: 'text-amber-500',   border: 'border-amber-500/25',  dot: 'bg-amber-500'   },
  interview_scheduled:  { bg: 'bg-violet-500/10',  text: 'text-violet-500',  border: 'border-violet-500/25', dot: 'bg-violet-500'  },
  rejected:             { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/25',    dot: 'bg-red-400'     },
  accepted:             { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/25',dot: 'bg-emerald-500' },
};

export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  'applied',
  'under_review',
  'shortlisted',
  'interview_scheduled',
  'accepted',
  'rejected',
];

export interface RankingEntry {
  ranking_id?: number;
  rank: number;
  score: number;
  resume_id: number;
  candidate_name: string | null;
  candidate_email: string | null;
  skills: string[];
  experience_years: number;
  education_level: string | null;
  matched_skills: string[];
  missing_skills: string[];
  skill_match_score: number;
  semantic_similarity: number;
  interview_questions: string[];
  shortlisted: boolean;
  notes: string;
  application_status: ApplicationStatus;
  recruiter_notes: string;
  interview_date: string | null;
  meeting_link: string;
  interview_instructions: string;
  updated_at: string | null;
}

export interface MyApplication {
  ranking_id: number;
  job_id: number;
  job_title: string;
  company: string | null;
  location: string | null;
  resume_id: number;
  resume_name: string | null;
  rank: number;
  score: number;
  application_status: ApplicationStatus;
  shortlisted: boolean;
  recruiter_notes: string;
  interview_date: string | null;
  meeting_link: string;
  interview_instructions: string;
  applied_at: string;
  updated_at: string | null;
}
