import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, LogOut, Save, Sparkles } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { uploadImageAsset } from '../lib/bharatplayService';
import { DEFAULT_LANGUAGES } from '../lib/catalogSeed';
import type { AppRoute } from '../types/bharatplay';

interface SettingsPageProps {
  onNavigate: (route: AppRoute) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const {
    user,
    profile,
    privateAccount,
    isCreator,
    becomeCreator,
    updateUserProfile,
    updatePrivateSettings,
    getIdToken,
    logout,
  } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [handle, setHandle] = useState(profile?.handle || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferredLanguage || 'Hindi');
  const [notificationsEnabled, setNotificationsEnabled] = useState(privateAccount?.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setHandle(profile.handle || '');
      setBio(profile.bio || '');
      setPreferredLanguage(profile.preferredLanguage || 'Hindi');
    }
  }, [profile]);

  useEffect(() => {
    if (privateAccount) {
      setNotificationsEnabled(privateAccount.notificationsEnabled ?? true);
    }
  }, [privateAccount]);

  if (!user || !profile) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-4">
        <h1 className="text-xl font-bold text-zinc-900 font-display">Account Settings</h1>
        <p className="text-sm text-zinc-600">Sign in to manage your channel and preferences.</p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleImageUpload = async (file: File, field: 'avatarUrl' | 'bannerUrl') => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const url = await uploadImageAsset(file, field === 'avatarUrl' ? 'avatar' : 'thumbnail', token);
      await updateUserProfile({ [field]: url });
      showToast(`${field === 'avatarUrl' ? 'Profile photo' : 'Channel banner'} updated!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Image upload failed.', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({
        displayName: displayName.trim().slice(0, 80),
        handle: handle.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40),
        bio: bio.trim().slice(0, 500),
        preferredLanguage,
      });
      await updatePrivateSettings({ notificationsEnabled });
      showToast('Profile & settings saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not update settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900">Channel & Account Settings</h1>
          <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            showToast('Signed out.', 'info');
            onNavigate('home');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-semibold text-zinc-900"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {!isCreator && (
        <div className="p-5 rounded-xl bg-orange-50/70 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EA580C]" />
              <span>Join the Early Creator Program</span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              Unlock video publishing, Bharat Shorts, Live Streaming, and Creator Support payouts.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await becomeCreator(bio || 'Creator on BharatPlay', preferredLanguage);
              showToast('Creator account enabled!', 'success');
            }}
            className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white whitespace-nowrap"
          >
            Become a Creator
          </button>
        </div>
      )}

      {/* Avatar & Banner Upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center gap-4">
          <MediaImage src={profile.avatarUrl} alt={profile.displayName} className="w-16 h-16 rounded-full object-cover border border-zinc-200" />
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-medium text-zinc-900">
            <ImageIcon className="w-4 h-4 text-[#EA580C]" />
            <span>Change Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatarUrl')}
              className="hidden"
            />
          </label>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-4">
          <div className="w-24 h-14 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200">
            <MediaImage src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-medium text-zinc-900">
            <ImageIcon className="w-4 h-4 text-[#E11D48]" />
            <span>Change Banner</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'bannerUrl')}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Channel Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Handle</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">About / Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">Preferred Regional Language</label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
          >
            {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-zinc-700 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="accent-[#E11D48]"
          />
          <span>Enable live stream, collaboration, and creator activity notifications</span>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
