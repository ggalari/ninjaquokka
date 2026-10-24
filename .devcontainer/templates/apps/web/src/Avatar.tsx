import { useEffect, useState } from 'react';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function Avatar({
  src,
  name,
  className = 'h-12 w-12',
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-medium text-slate-300 ${className}`}
        aria-hidden="true"
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
