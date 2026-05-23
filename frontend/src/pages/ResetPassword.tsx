import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../lib/api";

// ── Password strength ─────────────────────────────────────────────────────────

type Strength = "weak" | "fair" | "strong" | "very-strong";

function getStrength(pw: string): Strength {
  if (pw.length < 8) return "weak";
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "fair";
  if (score === 2) return "strong";
  return "very-strong";
}

const strengthMeta: Record<Strength, { label: string; color: string; bars: number }> = {
  weak:        { label: "Too short",   color: "bg-red-500",    bars: 1 },
  fair:        { label: "Fair",        color: "bg-amber-400",  bars: 2 },
  strong:      { label: "Strong",      color: "bg-sky-500",    bars: 3 },
  "very-strong": { label: "Very strong", color: "bg-emerald-500", bars: 4 },
};

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = getStrength(password);
  const meta = strengthMeta[s];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              bar <= meta.bars ? meta.color : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        s === "weak" ? "text-red-400" :
        s === "fair" ? "text-amber-400" :
        s === "strong" ? "text-sky-400" : "text-emerald-400"
      }`}>
        {meta.label}
      </p>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

interface FieldError {
  password?: string;
  confirm?: string;
}

function validate(password: string, confirm: string): FieldError {
  const errors: FieldError = {};
  if (!password) errors.password = "Password is required";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters";
  if (!confirm) errors.confirm = "Please confirm your password";
  else if (password !== confirm) errors.confirm = "Passwords do not match";
  return errors;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const errors = validate(password, confirm);
  const hasErrors = Object.keys(errors).length > 0;

  const field = (key: keyof FieldError) =>
    touched[key] && errors[key] ? errors[key] : undefined;

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
          <p className="text-slate-400 text-sm mb-6">
            This reset link is missing a token. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    if (hasErrors) return;

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Reset failed. The link may have expired.";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="card p-8">
          {success ? (
            /* ── Success state ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
              <p className="text-slate-400 text-sm">
                Redirecting you to login…
              </p>
            </motion.div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/25">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Set new password</h1>
                <p className="text-slate-400 text-sm mt-1">Must be at least 8 characters</p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* New password */}
                <div>
                  <label className="label" htmlFor="password">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className={`input pl-10 pr-10 ${field("password") ? "border-red-500 focus:ring-red-500" : ""}`}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {field("password") && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {field("password")}
                    </p>
                  )}
                  <StrengthMeter password={password} />
                </div>

                {/* Confirm password */}
                <div>
                  <label className="label" htmlFor="confirm">Confirm new password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      className={`input pl-10 pr-10 ${field("confirm") ? "border-red-500 focus:ring-red-500" : ""}`}
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {field("confirm") && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {field("confirm")}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center py-2.5 text-base mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Updating password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>

              <p className="text-center text-slate-400 text-sm mt-6">
                <Link to="/login" className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
