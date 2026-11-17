import React from 'react';

export function VideoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 animate-pulse">
          <div className="aspect-video w-full rounded-xl bg-zinc-200/70 border border-zinc-200" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-11/12 rounded bg-zinc-200" />
              <div className="h-3 w-3/5 rounded bg-zinc-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CreatorGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center gap-3.5 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-zinc-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-zinc-200" />
            <div className="h-3 w-1/2 rounded bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
