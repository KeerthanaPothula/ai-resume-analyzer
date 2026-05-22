import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  actionHref?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--border-color)" }}
      >
        <Icon className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p className="text-sm max-w-xs mb-6" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      {action && (
        <button onClick={action.onClick} className="btn-primary text-sm">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
