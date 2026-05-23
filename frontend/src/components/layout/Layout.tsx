import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Upload, Briefcase, BarChart3,
  LogOut, Brain, ChevronRight,
  Sun, Moon, Menu, X, Bell, UserCircle, Target,
} from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useThemeStore, applyTheme } from "../../stores/themeStore";
import { notificationApi } from "../../lib/api";
import toast from "react-hot-toast";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
}

const NAV: NavItem[] = [
  // Candidate navigation
  { label: "Dashboard",     path: "/candidate",    icon: LayoutDashboard, roles: ["candidate"] },
  { label: "Browse Jobs",   path: "/jobs",          icon: Briefcase,       roles: ["candidate"] },
  { label: "Upload Resume", path: "/upload",        icon: Upload,          roles: ["candidate"] },
  { label: "Job Match",     path: "/job-match",     icon: Target,          roles: ["candidate"] },
  // Recruiter navigation
  { label: "Dashboard",     path: "/recruiter",     icon: LayoutDashboard, roles: ["recruiter"] },
  { label: "Post a Job",    path: "/jobs/create",   icon: Briefcase,       roles: ["recruiter"] },
  // Admin navigation
  { label: "Dashboard",     path: "/admin",         icon: LayoutDashboard, roles: ["admin"] },
  { label: "Browse Jobs",   path: "/jobs",           icon: Briefcase,       roles: ["admin"] },
  { label: "Post a Job",    path: "/jobs/create",   icon: Briefcase,       roles: ["admin"] },
  { label: "Analytics",     path: "/admin",         icon: BarChart3,       roles: ["admin"] },
  // Shared
  { label: "Profile",       path: "/profile",       icon: UserCircle,      roles: ["candidate", "recruiter", "admin"] },
];

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const handleToggle = () => {
    toggleTheme();
    applyTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      onClick={handleToggle}
      aria-label="Toggle theme"
      className={clsx(
        "relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none",
        isDark ? "bg-sky-500" : "bg-slate-200"
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 flex items-center justify-center",
          isDark ? "translate-x-5" : "translate-x-0.5"
        )}
      >
        {isDark ? (
          <Moon className="w-2.5 h-2.5 text-sky-500" />
        ) : (
          <Sun className="w-2.5 h-2.5 text-amber-400" />
        )}
      </span>
    </button>
  );
}

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const { user, logout } = useAuth();
  const { theme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();

  const userNav = NAV.filter(
    (item) => user && item.roles.includes(user.role)
  );

  // Deduplicate by label+path
  const seen = new Set<string>();
  const uniqueNav = userNav.filter((item) => {
    const key = `${item.label}-${item.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const mainNav = uniqueNav.filter(
    (i) => !["Profile", "Settings"].includes(i.label)
  );
  const bottomNav = uniqueNav.filter((i) =>
    ["Profile", "Settings"].includes(i.label)
  );

  // Deduplicate bottom nav by path
  const seenBottom = new Set<string>();
  const uniqueBottom = bottomNav.filter((i) => {
    if (seenBottom.has(i.path)) return false;
    seenBottom.add(i.path);
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Signed out successfully");
  };

  const isDark = theme === "dark";

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--bg-sidebar)" }}
    >
      {/* Logo + close on mobile */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none" style={{ color: "var(--text-primary)" }}>
              Resume AI
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Intelligence Platform
            </p>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Role badge */}
      {user && (
        <div className="px-5 py-3">
          <span
            className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
              user.role === "candidate"
                ? "bg-sky-500/10 text-sky-500"
                : user.role === "recruiter"
                ? "bg-violet-500/10 text-violet-500"
                : "bg-emerald-500/10 text-emerald-500"
            )}
          >
            {user.role}
          </span>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto">
        <p
          className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Navigation
        </p>
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={`${item.label}-${item.path}`}
              to={item.path}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? isDark
                    ? "bg-sky-500/15 text-sky-400 border-l-2 border-sky-500"
                    : "bg-sky-50 text-sky-600 border-l-2 border-sky-500"
                  : isDark
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 opacity-60" />
              )}
            </Link>
          );
        })}

        {uniqueBottom.length > 0 && (
          <>
            <p
              className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Account
            </p>
            {uniqueBottom.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={onClose}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? isDark
                        ? "bg-sky-500/15 text-sky-400"
                        : "bg-sky-50 text-sky-600"
                      : isDark
                      ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom user section */}
      <div
        className="px-3 py-3 border-t space-y-1"
        style={{ borderColor: "var(--border-color)" }}
      >
        {/* Theme toggle row */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {isDark ? "Dark mode" : "Light mode"}
          </span>
          <ThemeToggle />
        </div>

        {/* User row */}
        {user && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--bg-base)" }}
          >
            <Avatar name={user.full_name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user.full_name}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={clsx(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            isDark
              ? "text-slate-400 hover:text-red-400 hover:bg-red-400/10"
              : "text-slate-500 hover:text-red-500 hover:bg-red-50"
          )}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function NotificationBell() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => notificationApi.unreadCount().then(r => r.data),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const unreadCount: number = (data as any)?.count ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => navigate("/notifications")}
        className="btn-ghost p-2 rounded-lg"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
      </button>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}

function TopNav({
  onMenuClick,
  title,
}: {
  onMenuClick: () => void;
  title?: string;
}) {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b sticky top-0 z-30"
      style={{
        backgroundColor: "var(--bg-topnav)",
        borderColor: "var(--border-color)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="btn-ghost p-1.5 rounded-lg lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title && (
          <h1 className="text-sm font-semibold hidden sm:block" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        {/* Avatar pill */}
        {user && (
          <Link
            to="/profile"
            className={clsx(
              "flex items-center gap-2 ml-1 px-2 py-1 rounded-lg transition-all",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
            )}
          >
            <Avatar name={user.full_name} />
            <span className="text-xs font-medium hidden sm:block" style={{ color: "var(--text-secondary)" }}>
              {user.full_name.split(" ")[0]}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}

export default function Layout({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useThemeStore();

  // Sync theme class on mount + changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 border-r flex-shrink-0"
        style={{ borderColor: "var(--border-color)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden shadow-xl"
            >
              <SidebarContent onClose={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
