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

export interface RankingEntry {
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
}
