import { useId } from "react";

/** Pictogramme Orbisys : planète (sphère réseau) + deux orbites croisées
 *  dégradé bleu→violet avec nœuds orbitaux. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  // Identifiants uniques : plusieurs logos peuvent coexister (barre latérale masquée + tiroir mobile).
  const uid = useId().replace(/:/g, "");
  const grad = `orbisys-grad-${uid}`;
  const planet = `orbisys-planet-${uid}`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="Orbisys">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <radialGradient id={planet} cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#0B1230" />
        </radialGradient>
      </defs>

      {/* Orbite arrière */}
      <ellipse cx="50" cy="50" rx="43" ry="16" fill="none" stroke={`url(#${grad})`}
               strokeWidth="4" transform="rotate(-27 50 50)" opacity="0.85" />

      {/* Planète */}
      <circle cx="50" cy="50" r="21" fill={`url(#${planet})`} stroke={`url(#${grad})`} strokeWidth="1.5" />
      {/* Points réseau sur la sphère */}
      <g fill="#38BDF8">
        <circle cx="44" cy="42" r="1.6" />
        <circle cx="56" cy="45" r="1.6" />
        <circle cx="48" cy="55" r="1.6" />
        <circle cx="59" cy="58" r="1.4" />
        <circle cx="41" cy="52" r="1.4" />
      </g>
      <g stroke="#38BDF8" strokeWidth="0.8" opacity="0.55">
        <line x1="44" y1="42" x2="56" y2="45" />
        <line x1="56" y1="45" x2="48" y2="55" />
        <line x1="48" y1="55" x2="41" y2="52" />
        <line x1="48" y1="55" x2="59" y2="58" />
      </g>

      {/* Orbite avant */}
      <ellipse cx="50" cy="50" rx="43" ry="16" fill="none" stroke={`url(#${grad})`}
               strokeWidth="4" transform="rotate(32 50 50)" />

      {/* Nœuds orbitaux */}
      <circle cx="83" cy="34" r="6.5" fill={`url(#${grad})`} />
      <circle cx="20" cy="63" r="6" fill={`url(#${grad})`} />
      <circle cx="80" cy="66" r="5.5" fill={`url(#${grad})`} />
    </svg>
  );
}
