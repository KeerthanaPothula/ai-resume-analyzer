import { clsx } from 'clsx';

interface SkillBadgeProps {
  skill: string;
  variant?: 'matched' | 'missing' | 'neutral';
}

export default function SkillBadge({ skill, variant = 'neutral' }: SkillBadgeProps) {
  return (
    <span
      className={clsx(
        'badge capitalize',
        variant === 'matched' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        variant === 'missing' && 'bg-red-500/20 text-red-400 border border-red-500/30',
        variant === 'neutral' && 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
      )}
    >
      {skill}
    </span>
  );
}
