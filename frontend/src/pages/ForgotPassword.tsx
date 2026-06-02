import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../lib/api";

function validate(email: string): string | undefined {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
  return undefined;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  const error = validate(email);
  const showError = touched && !!error;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;

    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSubmitted(true);
      if (res.data?.dev_reset_url) {
        setDevResetUrl(res.data.dev_reset_url);
      }
      if (res.data?.email_delivery_failed) {
        setEmailDeliveryFailed(true);
      }
    } catch (err: unknown) {
      type AxiosLike = {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { detail?: string; error?: string } };
      };
      const e = err as AxiosLike;

      let msg: string;
      if (!e.response) {
        // No response — network error, CORS block, or server unreachable
        if (e.code === "ECONNABORTED" || e.message?.toLowerCase().includes("timeout")) {
          msg =
            "The server took too long to respond. It may be starting up — please try again in 30 seconds.";
        } else {
          msg =
            "Cannot reach the server. Check that VITE_API_URL is set in Vercel and the backend allows this domain (CORS).";
        }
      } else if (e.response.status === 429) {
        msg = e.response.data?.detail ?? "Too many requests. Please wait a minute and try again.";
      } else {
        msg =
          e.response.data?.detail ??
          e.response.data?.error ??
          `Unexpected error (HTTP ${e.response.status ?? "unknown"}). Please try again.`;
      }
      toast.error(msg);
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
          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </Link>

          {submitted ? (
            /* ── Success state ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="flex justify-center mb-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  emailDeliveryFailed ? "bg-amber-500/15" : "bg-emerald-500/15"
                }`}>
                  {emailDeliveryFailed
                    ? <AlertTriangle className="w-7 h-7 text-amber-400" />
                    : <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  }
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {emailDeliveryFailed ? "Email delivery unavailable" : "Check your inbox"}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {emailDeliveryFailed
                  ? "We couldn't send a reset email to your address. Use the button below to reset your password directly."
                  : <>If <span className="text-slate-300">{email}</span> is registered, a password reset link has been sent. It expires in 30 minutes.</>
                }
              </p>

              {devResetUrl ? (
                <a
                  href={devResetUrl}
                  className="mt-5 btn-primary w-full justify-center py-2.5 flex items-center gap-2 no-underline"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Reset Password
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : emailDeliveryFailed ? (
                <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-amber-300 text-sm leading-relaxed">
                    Email delivery is down and the admin has not enabled fallback links.
                    Please contact support to reset your password.
                  </p>
                </div>
              ) : null}

              <button
                onClick={() => { setSubmitted(false); setEmail(""); setTouched(false); setDevResetUrl(null); setEmailDeliveryFailed(false); }}
                className="mt-6 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                {emailDeliveryFailed ? "Try again" : "Send another link"}
              </button>
            </motion.div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/25">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Forgot password?</h1>
                <p className="text-slate-400 text-sm mt-1 text-center">
                  Enter your email and we'll send a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label className="label" htmlFor="email">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`input pl-10 ${showError ? "border-red-500 focus:ring-red-500" : ""}`}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setTouched(true)}
                    />
                  </div>
                  {showError && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {error}
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
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>

              <p className="text-center text-slate-400 text-sm mt-6">
                Remember your password?{" "}
                <Link to="/login" className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
