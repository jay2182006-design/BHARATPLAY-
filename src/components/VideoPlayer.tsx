import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Gauge,
  Settings2,
  ListVideo,
} from 'lucide-react';
import { formatDuration } from '../lib/formatters';
import type { VideoChapter } from '../types/bharatplay';

export interface ExternalPlaybackSync {
  isPlaying: boolean;
  currentTime: number;
  seq: number;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title: string;
  isLive?: boolean;
  initialTime?: number;
  chapters?: VideoChapter[];
  onProgress?: (seconds: number) => void;
  externalSync?: ExternalPlaybackSync | null;
  onPlaybackAction?: (isPlaying: boolean, currentTime: number) => void;
  disableLocalControlNotice?: string;
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const QUALITIES = ['Auto (1080p)', '1080p HD', '720p', '480p', '360p'];

export function VideoPlayer({
  src,
  poster,
  title,
  isLive = false,
  initialTime = 0,
  chapters = [],
  onProgress,
  externalSync,
  onPlaybackAction,
  disableLocalControlNotice,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isRemoteSyncRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState('Auto (1080p)');
  const [fullscreen, setFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showChaptersMenu, setShowChaptersMenu] = useState(false);
  const lastReportedRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(0);
    setPlaying(false);
    v.load();
  }, [src]);

  useEffect(() => {
    const onFsChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Watch Party remote synchronization (guarded against feedback loops)
  useEffect(() => {
    if (!externalSync) return;
    const v = videoRef.current;
    if (!v) return;
    isRemoteSyncRef.current = true;
    const drift = Math.abs(v.currentTime - externalSync.currentTime);
    if (drift > 1.2) {
      v.currentTime = Math.max(0, externalSync.currentTime);
      setCurrentTime(v.currentTime);
    }
    if (externalSync.isPlaying && v.paused) {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            isRemoteSyncRef.current = false;
          }, 250);
        });
    } else if (!externalSync.isPlaying && !v.paused) {
      v.pause();
      setPlaying(false);
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 250);
    } else {
      setTimeout(() => {
        isRemoteSyncRef.current = false;
      }, 250);
    }
  }, [externalSync]);

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [chapters]
  );

  const activeChapter = useMemo(() => {
    if (sortedChapters.length === 0) return null;
    let current = sortedChapters[0];
    for (const ch of sortedChapters) {
      if (currentTime >= ch.timeSeconds) current = ch;
    }
    return current;
  }, [sortedChapters, currentTime]);

  const emitAction = (nextPlaying: boolean, nextTime: number) => {
    if (isRemoteSyncRef.current) return;
    onPlaybackAction?.(nextPlaying, nextTime);
  };

  const togglePlay = () => {
    if (disableLocalControlNotice) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => {
          setPlaying(true);
          emitAction(true, v.currentTime);
        })
        .catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
      emitAction(false, v.currentTime);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleSpeedChange = (nextSpeed: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = nextSpeed;
    setSpeed(nextSpeed);
    setShowSpeedMenu(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disableLocalControlNotice) return;
    const val = Number(e.target.value);
    const v = videoRef.current;
    if (v) v.currentTime = val;
    setCurrentTime(val);
    emitAction(playing, val);
  };

  const jumpToChapter = (seconds: number) => {
    if (disableLocalControlNotice) return;
    const v = videoRef.current;
    if (v) v.currentTime = seconds;
    setCurrentTime(seconds);
    setShowChaptersMenu(false);
    emitAction(playing, seconds);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 group select-none"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={isLive}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (!v) return;
          setDuration(v.duration || 0);
          if (initialTime > 0 && initialTime < (v.duration || 0) - 1) {
            v.currentTime = initialTime;
          }
          if (isLive) {
            v.play().then(() => setPlaying(true)).catch(() => {});
          }
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          if (onProgress && Math.abs(v.currentTime - lastReportedRef.current) >= 3) {
            lastReportedRef.current = v.currentTime;
            onProgress(v.currentTime);
          }
        }}
        onEnded={() => setPlaying(false)}
        className="w-full h-full object-contain bg-black cursor-pointer"
        aria-label={title}
      />

      {!playing && !disableLocalControlNotice && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity hover:bg-black/45"
        >
          <span className="w-16 h-16 rounded-full bg-[#E11D48] text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105">
            <Play className="w-7 h-7 fill-white ml-1" />
          </span>
        </button>
      )}

      {disableLocalControlNotice && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 border border-white/15 text-[11px] text-zinc-200">
          {disableLocalControlNotice}
        </div>
      )}

      {/* Control Bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-4 pt-8 pb-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
        {!isLive && (
          <div className="relative mb-3">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek video timeline"
              className="w-full h-1.5 accent-[#E11D48] cursor-pointer block"
            />
            {duration > 0 &&
              sortedChapters.map((ch, idx) => {
                const leftPct = Math.min(98, Math.max(0, (ch.timeSeconds / duration) * 100));
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => jumpToChapter(ch.timeSeconds)}
                    title={`${formatDuration(ch.timeSeconds)} — ${ch.title}`}
                    style={{ left: `${leftPct}%` }}
                    className="absolute -top-0.5 w-2 h-2.5 rounded-sm bg-[#F97316] border border-black hover:scale-125 transition-transform"
                  />
                );
              })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="p-2 text-white hover:text-[#F97316] transition-colors"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="p-2 text-white hover:text-[#F97316] transition-colors"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <span className="w-2 h-2 rounded-full bg-[#E11D48] animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="text-xs font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            )}

            {activeChapter && !isLive && (
              <button
                type="button"
                onClick={() => {
                  setShowChaptersMenu((s) => !s);
                  setShowQualityMenu(false);
                  setShowSpeedMenu(false);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-zinc-200 truncate max-w-[180px]"
              >
                <ListVideo className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                <span className="truncate">{activeChapter.title}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 relative">
            {sortedChapters.length > 0 && !isLive && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowChaptersMenu((s) => !s);
                    setShowQualityMenu(false);
                    setShowSpeedMenu(false);
                  }}
                  aria-label="Chapters"
                  className="sm:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 text-xs text-white"
                >
                  <ListVideo className="w-3.5 h-3.5" />
                </button>
                {showChaptersMenu && (
                  <div className="absolute bottom-10 right-0 bg-[#18181D] border border-white/15 rounded-xl p-1.5 shadow-2xl min-w-[220px] z-30">
                    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Chapters
                    </div>
                    {sortedChapters.map((ch, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => jumpToChapter(ch.timeSeconds)}
                        className={`w-full px-2.5 py-1.5 text-left text-xs rounded-lg flex items-center justify-between gap-2 ${
                          activeChapter?.timeSeconds === ch.timeSeconds
                            ? 'bg-[#E11D48] text-white'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{ch.title}</span>
                        <span className="font-mono text-[11px] opacity-80 shrink-0">
                          {formatDuration(ch.timeSeconds)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality Settings */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((s) => !s);
                  setShowSpeedMenu(false);
                  setShowChaptersMenu(false);
                }}
                aria-label="Video quality"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{quality.replace(' (1080p)', '')}</span>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-10 right-0 bg-[#18181D] border border-white/15 rounded-xl p-1.5 shadow-2xl min-w-[140px] z-30">
                  <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Quality
                  </div>
                  {QUALITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuality(q);
                        setShowQualityMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-xs text-left rounded-lg ${
                        quality === q ? 'bg-[#E11D48] text-white' : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isLive && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpeedMenu((s) => !s);
                    setShowQualityMenu(false);
                    setShowChaptersMenu(false);
                  }}
                  aria-label="Playback speed"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition-colors"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>{speed}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-10 right-0 bg-[#18181D] border border-white/15 rounded-xl p-1.5 shadow-2xl flex flex-col min-w-[82px] z-30">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Speed
                    </div>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSpeedChange(s)}
                        className={`px-3 py-1.5 text-xs font-mono text-left rounded-lg ${
                          speed === s ? 'bg-[#E11D48] text-white' : 'text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="p-2 text-white hover:text-[#F97316] transition-colors"
            >
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
