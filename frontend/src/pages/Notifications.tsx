import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, CheckCheck, Briefcase, Calendar,
  UserCheck, XCircle, Award, RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import { notificationApi } from "../lib/api";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string | null;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  application_received: { icon: Briefcase,   color: "text-sky-500" },
  status_updated:       { icon: RefreshCw,   color: "text-violet-500" },
  interview_scheduled:  { icon: Calendar,    color: "text-amber-500" },
  shortlisted:          { icon: UserCheck,   color: "text-emerald-500" },
  rejected:             { icon: XCircle,     color: "text-red-500" },
  accepted:             { icon: Award,       color: "text-emerald-500" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const label = formatDate(n.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list().then((r) => r.data),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      toast.success("All notifications marked as read");
    },
  });

  const handleClick = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const grouped = groupByDate(notifications);

  return (
    <Layout title="Notifications">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {unreadCount} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 animate-pulse flex gap-3">
                <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--border-color)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--border-color)" }} />
                  <div className="h-3 w-64 rounded" style={{ backgroundColor: "var(--border-color)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: "var(--border-color)" }}>
              <BellOff className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
            </div>
            <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
              No notifications yet
            </h3>
            <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
              Notifications about your applications and candidate activity will appear here.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {Object.entries(grouped).map(([dateLabel, items]) => (
                <motion.div
                  key={dateLabel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--text-muted)" }}>
                    {dateLabel}
                  </p>
                  <div className="space-y-1">
                    {items.map((n) => {
                      const cfg = n.type ? TYPE_CONFIG[n.type] : null;
                      const Icon = cfg?.icon ?? Bell;
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleClick(n)}
                          className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
                            n.action_url ? "cursor-pointer hover:opacity-80" : "cursor-default"
                          }`}
                          style={{
                            backgroundColor: n.read ? "var(--bg-card)" : "var(--bg-base)",
                            border: `1px solid ${n.read ? "var(--border-color)" : "transparent"}`,
                            boxShadow: n.read ? "none" : "0 0 0 1px var(--accent)",
                          }}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            n.read ? "opacity-50" : ""
                          }`}
                            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-color)" }}>
                            <Icon className={`w-4 h-4 ${cfg?.color ?? "text-slate-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${n.read ? "" : "font-semibold"}`}
                              style={{ color: "var(--text-primary)" }}>
                              {n.title}
                              {!n.read && (
                                <span className="ml-2 inline-block w-2 h-2 rounded-full bg-sky-500 align-middle" />
                              )}
                            </p>
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                              {n.message}
                            </p>
                            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}
