import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Brain, Loader2, ChevronDown,
} from "lucide-react";
import { aiFeedbackApi, resumeApi } from "../lib/api";
import { ChatMessage, Resume } from "../types";

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center flex-shrink-0">
        <Brain className="w-3 h-3 text-white" />
      </div>
      <div className="chat-bubble-ai flex items-center gap-1 py-3 px-4">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

export default function ChatAssistant() {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI career coach. Ask me anything about your resume, job search, interviews, or career growth.",
    },
  ]);
  const [resumeId, setResumeId] = useState<number | "">("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const { data: resumes = [] } = useQuery<Resume[]>({
    queryKey: ["resumes"],
    queryFn: () => resumeApi.list().then((r) => r.data),
    enabled: open,
  });

  // Auto-select the first resume when resumes load (user can still override)
  useEffect(() => {
    if (resumes.length > 0 && resumeId === "") {
      setResumeId(resumes[0].id);
    }
  }, [resumes]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: ({ text, history }: { text: string; history: ChatMessage[] }) =>
      aiFeedbackApi
        .chat(text, resumeId === "" ? undefined : resumeId, history)
        .then((r) => r.data.reply as string),
    onSuccess: (reply) => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't connect right now. Please try again in a moment.",
        },
      ]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || isPending) return;
    const history = messages.slice(1); // exclude the initial greeting
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    sendMessage({ text, history });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-white flex items-center justify-center shadow-xl shadow-violet-500/30 transition-all"
        aria-label="AI Career Coach"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="w-5 h-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              height: "520px",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{
                borderColor: "var(--border-color)",
                background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(14,165,233,0.08))",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    AI Career Coach
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Powered by Gemini
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon w-7 h-7"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resume context selector */}
            {resumes.length > 0 && (
              <div
                className="px-3 py-2 border-b flex-shrink-0"
                style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-base)" }}
              >
                <select
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <option value="">No resume context</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.original_name} (ATS {r.ats_score.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isPending && <TypingIndicator />}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="flex items-center gap-2 px-3 py-3 border-t flex-shrink-0"
              style={{ borderColor: "var(--border-color)" }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask me anything…"
                disabled={isPending}
                className="flex-1 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                style={{
                  backgroundColor: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isPending}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #0ea5e9)",
                  color: "white",
                }}
                aria-label="Send"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
