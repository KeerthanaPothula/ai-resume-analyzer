import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, X, CheckCircle, Loader2, AlertCircle,
  Brain, Zap, BarChart3, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import { resumeApi } from "../lib/api";
import { useThemeStore } from "../stores/themeStore";

type UploadStage = "idle" | "uploading" | "parsing" | "scoring" | "done" | "error";

const STAGES: { key: UploadStage; label: string; icon: React.ElementType }[] = [
  { key: "uploading", label: "Uploading file",    icon: Upload    },
  { key: "parsing",  label: "Parsing content",   icon: FileText  },
  { key: "scoring",  label: "AI analysis",        icon: Brain     },
  { key: "done",     label: "Complete",            icon: CheckCircle },
];

function StageBar({ stage }: { stage: UploadStage }) {
  const active = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-0 w-full mt-6 mb-2">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const done = active > i || stage === "done";
        const current = active === i && stage !== "done";
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white"
                    : current
                    ? "bg-sky-500 text-white ring-4 ring-sky-500/20"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                }`}
              >
                {current ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className="text-[10px] font-medium text-center leading-tight"
                style={{ color: done || current ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 mb-4 transition-all duration-500"
                style={{
                  backgroundColor: done ? "rgb(16 185 129)" : "var(--border-color)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [resumeId, setResumeId] = useState<number | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setStage("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejected) => {
      const code = rejected[0]?.errors[0]?.code;
      toast.error(code === "file-too-large" ? "File too large (max 10 MB)" : "Only PDF and DOCX supported");
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    // Step through stages with timed delays to show progress
    setStage("uploading");
    try {
      // Start the actual upload
      const uploadPromise = resumeApi.upload(file);

      // Simulate sequential stage ticks while upload is in flight
      await new Promise((r) => setTimeout(r, 600));
      setStage("parsing");
      await new Promise((r) => setTimeout(r, 900));
      setStage("scoring");

      const res = await uploadPromise;
      setResumeId(res.data.id);
      setStage("done");
      toast.success("Resume analyzed successfully!");
      qc.invalidateQueries({ queryKey: ["dashboard", "candidate"] });
    } catch (err: unknown) {
      setStage("error");
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(detail || "Upload failed — please try again");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isUploading = ["uploading", "parsing", "scoring"].includes(stage);

  return (
    <Layout title="Upload Resume">
      <div className="p-5 md:p-7 max-w-2xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Upload Resume
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Upload a PDF or DOCX and our AI will extract skills, score ATS fitness, and generate feedback.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {stage === "done" ? (
            /* ── Success state ── */
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-10 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                Analysis Complete!
              </h3>
              <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>
                Your resume has been parsed, skills extracted, and ATS score calculated.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => resumeId && navigate(`/analysis/${resumeId}`)}
                  className="btn-primary text-sm"
                >
                  View Full Analysis <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setFile(null); setStage("idle"); setResumeId(null); }}
                  className="btn-secondary text-sm"
                >
                  Upload Another
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? "border-sky-400 bg-sky-500/10"
                    : file
                    ? "border-violet-500/50 bg-violet-500/5"
                    : isDark
                    ? "border-slate-600 hover:border-sky-500/40 hover:bg-sky-500/5"
                    : "border-slate-300 hover:border-sky-400 hover:bg-sky-50"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      isDragActive
                        ? "bg-sky-500/20 scale-110"
                        : isDark ? "bg-slate-700/60" : "bg-slate-100"
                    }`}
                  >
                    <Upload className={`w-7 h-7 ${isDragActive ? "text-sky-400" : "text-slate-400"}`} />
                  </div>
                  {isDragActive ? (
                    <p className="font-semibold text-sky-400">Drop it here!</p>
                  ) : (
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        Drag & drop or click to browse
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        PDF or DOCX — max 10 MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* File preview */}
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4.5 h-4.5 text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {file.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setStage("idle"); }}
                      className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X className="w-4 h-4 hover:text-red-400" />
                    </button>
                  )}
                </motion.div>
              )}

              {/* Stage progress bar (shown while uploading) */}
              {isUploading && <StageBar stage={stage} />}

              {/* Error */}
              {stage === "error" && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">Upload failed. Please check your file and try again.</p>
                </div>
              )}

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="btn-primary w-full justify-center py-3 text-sm"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with AI…</>
                ) : (
                  <><Zap className="w-4 h-4" /> Upload & Analyze</>
                )}
              </button>

              {/* Feature badges */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: FileText,   label: "Smart Parsing"  },
                  { icon: Brain,      label: "Skill Detection" },
                  { icon: BarChart3,  label: "ATS Scoring"    },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="card p-3 text-center">
                    <Icon className="w-4 h-4 text-sky-500 mx-auto mb-1.5" />
                    <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
