import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Shield, Save, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import { profileApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../stores/themeStore";

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-sky-500" />
        </div>
        <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-sky-500/30 transition-all"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const [name, setName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
      await profileApi.updateMe(user!.id, { full_name: name.trim(), email: email.trim() });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await profileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const roleColor =
    user?.role === "candidate"
      ? "bg-sky-500/10 text-sky-500"
      : user?.role === "recruiter"
      ? "bg-violet-500/10 text-violet-500"
      : "bg-emerald-500/10 text-emerald-500";

  return (
    <Layout title="Profile & Settings">
      <div className="p-5 md:p-7 max-w-3xl mx-auto space-y-6 animate-fade-in">

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5"
        >
          <Avatar name={user?.full_name ?? "U"} size={80} />
          <div className="flex-1 text-center sm:text-left">
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {user?.full_name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {user?.email}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${roleColor}`}>
                {user?.role}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                  user?.is_active
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                {user?.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div
            className={`hidden sm:flex flex-col items-end text-xs gap-1`}
            style={{ color: "var(--text-muted)" }}
          >
            <span>Member since</span>
            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
        </motion.div>

        {/* Profile info */}
        <Section title="Personal Information" icon={User}>
          <div className="space-y-4">
            <Field
              label="Full Name"
              value={name}
              onChange={setName}
              placeholder="Your full name"
            />
            <Field
              label="Email Address"
              value={email}
              type="email"
              onChange={setEmail}
              placeholder="you@example.com"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="btn-primary text-sm"
            >
              {savingProfile ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </Section>

        {/* Change password */}
        <Section title="Change Password" icon={Lock}>
          <div className="space-y-4">
            <Field
              label="Current Password"
              value={currentPassword}
              type={showCurrent ? "text" : "password"}
              onChange={setCurrentPassword}
              placeholder="Enter current password"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <Field
              label="New Password"
              value={newPassword}
              type={showNew ? "text" : "password"}
              onChange={setNewPassword}
              placeholder="Min 8 characters"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <Field
              label="Confirm New Password"
              value={confirmPassword}
              type="password"
              onChange={setConfirmPassword}
              placeholder="Repeat new password"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="btn-primary text-sm"
            >
              {savingPassword ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Update Password
            </button>
          </div>
        </Section>

        {/* Account info */}
        <Section title="Account Details" icon={Shield}>
          <div className="space-y-3">
            {[
              { label: "User ID", value: `#${user?.id}` },
              { label: "Role", value: user?.role ?? "—" },
              {
                label: "Account Status",
                value: user?.is_active ? "Active" : "Inactive",
              },
              {
                label: "Joined",
                value: user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                  isDark ? "bg-slate-800/50" : "bg-slate-50"
                }`}
              >
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {label}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </Layout>
  );
}
