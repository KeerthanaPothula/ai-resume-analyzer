import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain, CheckCircle2, XCircle, Loader2, RefreshCw, Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../lib/api";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("");

  // Resend-from-error form state
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found in this link.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setState("success");
        setMessage(res.data.message ?? "Email verified successfully.");
      })
      .catch((err) => {
        setState("error");
        setMessage(
          err?.response?.data?.detail ?? "Invalid or expired verification link."
        );
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail.trim() || resending) return;
    setResending(true);
    try {
      await authApi.resendVerification(resendEmail.trim());
      setResent(true);
      toast.success("Verification email sent! Check your inbox.");
    } catch {
      toast.error("Failed to send. Please check the email address.");
    } finally {
      setResending(false);
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
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">RecruitAI</span>
          </div>

          {/* Loading */}
          {state === "loading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
              <p className="text-slate-400 text-sm">Verifying your email address...</p>
            </motion.div>
          )}

          {/* Success */}
          {state === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Email verified!</h1>
                <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
              </div>
              <Link
                to="/login"
                className="btn-primary mt-2 px-10 py-2.5 justify-center"
              >
                Sign in to RecruitAI
              </Link>
            </motion.div>
          )}

          {/* Error */}
          {state === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
                <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
              </div>

              {/* Request new link */}
              {!resent ? (
                <div className="w-full space-y-2 pt-2">
                  <p className="text-slate-400 text-xs mb-3">
                    Enter your email to request a new verification link:
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      className="input pl-10 w-full"
                      placeholder="you@example.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleResend()}
                    />
                  </div>
                  <button
                    onClick={handleResend}
                    disabled={!resendEmail.trim() || resending}
                    className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Send new link</>
                    )}
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-emerald-400 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  New link sent! Check your inbox.
                </motion.div>
              )}

              <Link
                to="/login"
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Back to sign in
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
