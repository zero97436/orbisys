import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Card({
  children,
  className,
  hover,
  id,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "card p-5",
        hover && "transition hover:border-ink-faint/60 hover:shadow-glow",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
  icon: Icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Conteneur animé pour l'apparition en cascade des cartes. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function MotionGrid({ children, className }: { children: ReactNode; className?: string }) {
  // « Réduire les animations » : pas de fondu d'entrée (initial={false} vaut pour tous les enfants).
  const reduce = useReducedMotion();
  return (
    <motion.div variants={stagger} initial={reduce ? false : "hidden"} animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
