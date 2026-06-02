import { useState, useEffect } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain, Mail, RefreshCw, Loader2, CheckCircle2, ArrowLeft,
  AlertTriangle, ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../lib/api";

export default function VerificationPending() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const location = useLocation();

  const initial = (location.state ?? {}) as {
    devVerifyUrl?: string;
    emailDeliveryFailed?: boolean;
  };

  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | undefined>(initial.devVerifyUrl);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(initial.emailDeliveryFailed ?? false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || sending || !email) return;
    setSending(true);
    try {
      const res = await authApi.resendVerification(email);
      const data = (res.data ?? {}) as { dev_verify_url?: string; email_delivery_failed?: boolean };
      if (data.email_delivery_failed) {
        setEmailDeliveryFailed(true);
        if (data.dev_verify_url) setDevVerifyUrl(data.dev_verify_url);
        toast.error("Email delivery unavailable. Use the verification link below.");
      } else {
        setSent(true);
        setEmailDeliveryFailed(false);
        setCooldown(60);
        toast.success("Verification email sent!");
      }
    } catch {
      toast.error("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="card p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-white">RecruitAI</span>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
              emailDeliveryFailed
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-sky-500/10 border border-sky-500/20"
            }`}>
              {emailDeliveryFailed
                ? <AlertTriangle className="w-10 h-10 text-amber-400" />
                : <Mail className="w-10 h-10 text-sky-400" />
              }
            </div>
          </div>

          {emailDeliveryFailed ? (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Email delivery unavailable
              </h1>
              <p className="text-slate-400 text-sm text-center leading-relaxed mb-1">
                We couldn't send a verification email to
              </p>
              {email && (
                <p className="text-sky-400 font-medium text-center text-sm mb-4 break-all">
                  {email}
                </p>
              )}
              <p className="text-slate-400 text-sm text-center leading-relaxed mb-6">
                Your account was created successfully. Use the button below to verify and activate it.
              </p>

              {devVerifyUrl ? (
                <a
                  href={devVerifyUrl}
                  className="btn-primary w-full justify-center py-2.5 mb-3 flex items-center gap-2 no-underline"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Verify Account
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4 text-center">
                  <p className="text-amber-300 text-sm leading-relaxed">
                    Email delivery is down and the admin has not enabled fallback links.
                    Please contact support to get your account activated.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Check your inbox
              </h1>
              <p className="text-slate-400 text-sm text-center leading-relaxed mb-1">
                We sent a verification link to
              </p>
              {email && (
                <p className="text-sky-400 font-medium text-center text-sm mb-5 break-all">
                  {email}
                </p>
              )}
              <p className="text-slate-400 text-sm text-center leading-relaxed mb-8">
                Click the link in the email to activate your account. The link expires in 24 hours.
              </p>
            </>
          )}

          {/* Resend button */}
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || sending || !email}
            className="btn-primary w-full justify-center py-2.5 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
            ) : cooldown > 0 ? (
              <><RefreshCw className="w-4 h-4" /> Resend in {cooldown}s</>
            ) : emailDeliveryFailed ? (
              <><RefreshCw className="w-4 h-4" /> Retry sending email</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> {sent ? "Resend email" : "Resend verification email"}</>
            )}
          </button>

          {sent && !emailDeliveryFailed && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-emerald-400 text-xs flex items-center justify-center gap-1.5 mb-4"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Email sent! Check your inbox (and spam folder).
            </motion.p>
          )}

          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>

        {!emailDeliveryFailed && (
          <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-medium">Tip:</span> Check your spam or junk
              folder if you don't see the email within a few minutes.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
