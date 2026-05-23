import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md"
      >
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-xl shadow-sky-500/25 mx-auto mb-6">
          <Brain className="w-7 h-7 text-white" />
        </div>

        {/* 404 */}
        <div
          className="text-8xl font-extrabold tracking-tight mb-4 select-none"
          style={{
            background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Page not found
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary text-sm">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => history.back()}
            className="btn-secondary text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
