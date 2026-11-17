import React, { useState } from 'react';
import {
  Upload,
  Film,
  Smartphone,
  Image as ImageIcon,
  X,
  Music2,
  Trophy,
  Plus,
  Trash2,
  ListVideo,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import {
  publishVideo,
  uploadImageAsset,
  uploadVideoWithProgress,
} from '../lib/bharatplayService';
import { DEFAULT_CATEGORIES, DEFAULT_LANGUAGES } from '../lib/catalogSeed';
import type { CreatorChallenge, VideoChapter } from '../types/bharatplay';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: 'video' | 'short';
  challenges: CreatorChallenge[];
  onPublished?: (videoId: string, type: 'video' | 'short') => void;
}

export function UploadModal({
  open,
  onClose,
  defaultType = 'video',
  challenges,
  onPublished,
}: UploadModalProps) {
  const { user, profile, isCreator, becomeCreator, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [type, setType] = useState<'video' | 'short'>(defaultType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [language, setLanguage] = useState(profile?.preferredLanguage || 'Hindi');
  const [musicTrack, setMusicTrack] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [chapTime, setChapTime] = useState('0');
  const [chapTitle, setChapTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const categories = DEFAULT_CATEGORIES.filter((c) => c !== 'All');
  const languages = DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages');

  const handleAddChapter = () => {
    const cleanTitle = chapTitle.trim();
    const secs = Math.max(0, Number(chapTime) || 0);
    if (!cleanTitle) return;
    setChapters((prev) =>
      [...prev, { timeSeconds: secs, title: cleanTitle }]
        .sort((a, b) => a.timeSeconds - b.timeSeconds)
        .slice(0, 20)
    );
    setChapTitle('');
    setChapTime(String(secs + 15));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      showToast('Please sign in first to publish on BharatPlay.', 'error');
      return;
    }
    if (!title.trim() || title.trim().length < 2) {
      showToast('Please enter a video title (at least 2 characters).', 'error');
      return;
    }
    if (!videoFile) {
      showToast('Please select an MP4, WebM, or MOV video file to upload.', 'error');
      return;
    }

    setSubmitting(true);
    setProgress(5);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication session expired. Please sign in again.');

      if (!isCreator) {
        await becomeCreator(profile.bio || 'Indian creator on BharatPlay', language);
      }

      const uploadedVideo = await uploadVideoWithProgress(videoFile, token, (pct) => {
        setProgress(Math.max(10, Math.min(85, pct)));
      });

      let thumbUrl =
        type === 'short'
          ? '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg'
          : '/src/assets/images/thumb_tech_india_1794912701310.jpg';

      if (thumbFile) {
        thumbUrl = await uploadImageAsset(thumbFile, 'thumbnail', token);
      }

      setProgress(95);

      const vidId = await publishVideo({
        creator: { ...profile, isCreator: true },
        title,
        description,
        videoUrl: uploadedVideo.url,
        thumbnailUrl: thumbUrl,
        type,
        category,
        language,
        durationSeconds: 12,
        musicTrack: type === 'short' ? musicTrack : '',
        challengeId,
        tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
        chapters: type === 'video' ? chapters : [],
      });

      setProgress(100);
      showToast(`${type === 'short' ? 'Bharat Short' : 'Video'} published live!`, 'success');
      setTitle('');
      setDescription('');
      setChapters([]);
      setVideoFile(null);
      setThumbFile(null);
      onPublished?.(vidId, type);
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden my-8 text-zinc-900">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-bold font-display text-zinc-900">Publish to BHARATPLAY</h2>
            <p className="text-xs text-zinc-500">
              Videos stream via chunked HTTP range delivery; metadata saves to your channel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload dialog"
            className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Format Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('video')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${
                type === 'video'
                  ? 'bg-[#E11D48]/10 border-[#E11D48] text-[#BE123C]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Standard Video (16:9)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('short')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${
                type === 'short'
                  ? 'bg-orange-50 border-[#F97316] text-[#EA580C]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Bharat Short (9:16)</span>
            </button>
          </div>

          {/* Video & Thumbnail File Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-zinc-300 hover:border-[#E11D48] bg-zinc-50 cursor-pointer transition-colors text-center">
              <Upload className="w-6 h-6 text-[#E11D48]" />
              <span className="text-sm font-medium text-zinc-900 truncate max-w-full">
                {videoFile ? videoFile.name : 'Select Video File (MP4 / WebM)'}
              </span>
              <span className="text-xs text-zinc-500">
                {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Up to 250 MB'}
              </span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-zinc-300 hover:border-[#F97316] bg-zinc-50 cursor-pointer transition-colors text-center">
              <ImageIcon className="w-6 h-6 text-[#EA580C]" />
              <span className="text-sm font-medium text-zinc-900 truncate max-w-full">
                {thumbFile ? thumbFile.name : 'Custom Thumbnail (Optional)'}
              </span>
              <span className="text-xs text-zinc-500">JPG, PNG or WebP</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Title</label>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a clear, compelling title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E11D48]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Description</label>
            <textarea
              rows={3}
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what your story is about..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E11D48]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#E11D48]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Regional Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#E11D48]"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === 'video' && (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <ListVideo className="w-4 h-4 text-[#EA580C]" />
                  Video Chapters (Optional)
                </span>
                <span className="text-[11px] text-zinc-500">Timestamp in seconds</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={chapTime}
                  onChange={(e) => setChapTime(e.target.value)}
                  placeholder="Sec"
                  className="w-20 px-2.5 py-2 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900"
                />
                <input
                  type="text"
                  value={chapTitle}
                  onChange={(e) => setChapTitle(e.target.value)}
                  placeholder="Chapter title (e.g., Intro & Setup)"
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900 placeholder-zinc-400"
                />
                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="px-3 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-xs font-semibold text-zinc-900 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {chapters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chapters.map((ch, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-800"
                    >
                      <span className="font-mono text-[#EA580C]">{ch.timeSeconds}s</span>
                      <span>{ch.title}</span>
                      <button
                        type="button"
                        onClick={() => setChapters((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-400 hover:text-[#E11D48]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {type === 'short' && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 mb-1.5">
                <Music2 className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Sound / Music Attribution</span>
              </label>
              <input
                type="text"
                maxLength={120}
                value={musicTrack}
                onChange={(e) => setMusicTrack(e.target.value)}
                placeholder="e.g., Original Acoustic Loop — Pune Studio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#F97316]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 mb-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Submit to Creator Challenge (Optional)</span>
              </label>
              <select
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#E11D48]"
              >
                <option value="">None</option>
                {challenges
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="bengaluru, documentary, tech"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E11D48]"
              />
            </div>
          </div>

          {submitting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-700">
                <span>Uploading and publishing...</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E11D48] to-[#F97316] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 rounded-xl transition-colors"
            >
              {submitting ? 'Publishing...' : 'Publish Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
