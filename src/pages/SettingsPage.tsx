import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, LogOut, Moon, QrCode, Save, Sparkles, Sun } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
  const { theme, setTheme, toggleTheme } = useTheme();
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

  const ThemeSwitcherSection = (
    <section className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-[#F97316]" />
          ) : (
            <Sun className="w-4 h-4 text-[#F97316]" />
          )}
          <span>Appearance & Theme</span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Switch between Dark Mode and Light Mode across BharatPlay. Saved automatically across sessions.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div
          role="group"
          aria-label="Theme selection"
          className="inline-flex items-center p-1 rounded-xl bg-zinc-200/80 dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              showToast('Switched to Dark Mode', 'success');
            }}
            aria-pressed={theme === 'dark'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              theme === 'dark'
                ? 'bg-[#18181D] text-white shadow-sm border border-zinc-700'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('light');
              showToast('Switched to Light Mode', 'success');
            }}
            aria-pressed={theme === 'light'}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              theme === 'light'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Light</span>
          </button>
        </div>

        <button
          type="button"
          onClick={async () => {
            const nextLabel = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
            await toggleTheme();
            showToast(`Switched to ${nextLabel}`, 'success');
          }}
          aria-label={theme === 'dark' ? 'Toggle to Light Mode' : 'Toggle to Dark Mode'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
        >
          <span
            className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-[#09090B] shadow-sm transition-transform duration-200 ease-out ${
              theme === 'light' ? 'translate-x-7' : 'translate-x-1'
            }`}
          >
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-[#F97316]" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[#F97316]" />
            )}
          </span>
        </button>
      </div>
    </section>
  );

  if (!user || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-6">
        {ThemeSwitcherSection}
        <div className="max-w-lg mx-auto p-8 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white font-display">Account Settings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to manage your channel and sync your theme preference across devices.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white transition-colors"
          >
            Sign In
          </button>
        </div>
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
      await updatePrivateSettings({ notificationsEnabled, themePreference: theme });
      showToast('Profile & settings saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not update settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">
            Channel & Account Settings
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            showToast('Signed out.', 'info');
            onNavigate('home');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Appearance & Theme Switcher */}
      {ThemeSwitcherSection}

      {/* UPI Payments & History Shortcut */}
      <section className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
            <QrCode className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
            <span>UPI Payments & Verification History</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Scan merchant QR, submit PhonePe / GPay / Paytm UTR numbers, and track CEO verification status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('payments')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] text-xs font-semibold text-white whitespace-nowrap shrink-0"
        >
          Open Payments Hub
        </button>
      </section>

      {!isCreator && (
        <div className="p-5 rounded-xl bg-orange-50/70 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EA580C]" />
              <span>Join the Early Creator Program</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
              Unlock video publishing, Bharat Shorts, Live Streaming, and Creator Support payouts.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await becomeCreator(bio || 'Creator on BharatPlay', preferredLanguage);
              showToast('Creator account enabled!', 'success');
            }}
            className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-semibold text-white whitespace-nowrap transition-colors"
          >
            Become a Creator
          </button>
        </div>
      )}

      {/* Avatar & Banner Upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
          <MediaImage
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-16 h-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
          />
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white transition-colors">
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

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="w-24 h-14 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
            <MediaImage src={profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#18181D] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white transition-colors">
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

      <form
        onSubmit={handleSave}
        className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Channel Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Handle
            </label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            About / Bio
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Preferred Regional Language
          </label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
          >
            {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-1">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
