import { clsx } from 'clsx';
import { formatSkill } from '../../utils/formatSkill';

interface SkillBadgeProps {
  skill: string;
  variant?: 'matched' | 'missing' | 'neutral';
}

export default function SkillBadge({ skill, variant = 'neutral' }: SkillBadgeProps) {
  return (
    <span
      className={clsx(
        'badge',
        variant === 'matched' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
        variant === 'missing' && 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
        variant === 'neutral' && 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30'
      )}
    >
      {formatSkill(skill)}
    </span>
  );
}
