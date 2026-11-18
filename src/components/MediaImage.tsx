import React, { useState } from 'react';
import { Film } from 'lucide-react';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function MediaImage({ src, alt, className = '', fallbackLabel }: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200 dark:from-[#18181D] dark:via-[#141418] dark:to-[#09090B] text-zinc-500 dark:text-zinc-400 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Film className="w-6 h-6 text-[#EA580C]/80 dark:text-[#F97316]/80 mb-1" />
        {fallbackLabel && (
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 px-3 text-center line-clamp-1">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
}
