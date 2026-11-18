import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bookmark,
  Compass,
  Crown,
  Flame,
  History,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  PlusSquare,
  QrCode,
  Radio,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trophy,
  Tv,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { MediaImage } from './MediaImage';
import { markAllNotificationsRead, markNotificationRead } from '../lib/bharatplayService';
import type {
  AppRoute,
  PlatformAnnouncement,
  UserNotification,
  UserPublicProfile,
  VideoItem,
} from '../types/bharatplay';

interface LayoutShellProps {
  route: AppRoute;
  onNavigate: (route: AppRoute, param?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (q: string) => void;
  onOpenUpload: () => void;
  videos: VideoItem[];
  creators: UserPublicProfile[];
  notifications: UserNotification[];
  announcements: PlatformAnnouncement[];
  children: React.ReactNode;
}

export function LayoutShell({
  route,
  onNavigate,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onOpenUpload,
  videos,
  creators,
  notifications,
  announcements,
  children,
}: LayoutShellProps) {
  const { user, profile, isAdmin, isCeo, isSuspended } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matchedVideos = videos
      .filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.language.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((v) => ({ label: v.title, sub: `${v.creatorName} · ${v.language}`, query: v.title }));
    const matchedCreators = creators
      .filter((c) => c.displayName.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q))
      .slice(0, 2)
      .map((c) => ({ label: c.displayName, sub: `Creator · @${c.handle}`, query: c.displayName }));
    return [...matchedVideos, ...matchedCreators].slice(0, 6);
  }, [searchQuery, videos, creators]);

  const primaryNav: { id: AppRoute; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'explore', label: 'Explore & Regions', icon: <Compass className="w-4 h-4" /> },
    { id: 'shorts', label: 'Bharat Shorts', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'live', label: 'Live Now', icon: <Radio className="w-4 h-4" /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <Users className="w-4 h-4" /> },
  ];

  const communityNav: { id: AppRoute; label: string; icon: React.ReactNode }[] = [
    { id: 'boost', label: 'Creator Boost', icon: <Rocket className="w-4 h-4" /> },
    { id: 'league', label: 'Creator League', icon: <Trophy className="w-4 h-4" /> },
    { id: 'watch-party', label: 'Watch Party', icon: <Tv className="w-4 h-4" /> },
    { id: 'watch-later', label: 'Watch Later', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'history', label: 'Watch History', icon: <History className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments & History', icon: <QrCode className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  const handleNavClick = (r: AppRoute, param?: string) => {
    setSidebarOpen(false);
    onNavigate(r, param);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090B] text-zinc-900 dark:text-zinc-50 flex flex-col transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-14 md:h-16 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 md:px-6 flex items-center justify-between gap-4 md:gap-8 transition-colors duration-200">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle navigation menu"
            className="hidden md:flex lg:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E11D48] to-[#F97316] flex items-center justify-center shadow-sm shadow-[#E11D48]/25">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </span>
            <span className="font-display font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
              BHARAT<span className="text-[#F97316]">PLAY</span>
            </span>
          </button>
        </div>

        {/* Search Bar with Autocomplete Suggestions */}
        <div className="relative flex-1 max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShowSuggestions(false);
              onSearchSubmit(searchQuery);
            }}
            className="flex items-center w-full bg-zinc-50 dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 focus-within:border-[#F97316] focus-within:bg-white dark:focus-within:bg-[#18181D] rounded-xl overflow-hidden transition-colors"
          >
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Search Indian creators, videos, languages..."
              className="w-full bg-transparent px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="px-3.5 py-2 bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border-l border-zinc-200 dark:border-zinc-800 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-12 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => {
                    onSearchChange(item.query);
                    onSearchSubmit(item.query);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/70 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/70 last:border-0"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-900 dark:text-white truncate">{item.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenUpload}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <PlusSquare className="w-4 h-4 text-[#E11D48]" />
            <span>Create</span>
          </button>

          {/* Notification Center Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifs((s) => !s)}
              aria-label="Notifications"
              className="relative p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E11D48] text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">Notification Center</span>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead(notifications)}
                        className="text-[11px] font-medium text-[#EA580C] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifs(false);
                        handleNavClick('notifications');
                      }}
                      className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      View all
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                  {announcements.slice(0, 1).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setShowNotifs(false);
                        handleNavClick('notifications');
                      }}
                      className="w-full text-left px-4 py-3 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100/70 dark:hover:bg-orange-950/50 transition-colors"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#EA580C]">
                        Platform Announcement
                      </div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white mt-0.5">{a.title}</div>
                    </button>
                  ))}

                  {notifications.length === 0 ? (
                    <div className="p-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      You are all caught up.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.isRead) markNotificationRead(n.id).catch(() => {});
                          setShowNotifs(false);
                          if (n.linkPath === '/studio') handleNavClick('studio');
                          else if (n.linkPath === '/payments') handleNavClick('payments');
                          else handleNavClick('notifications');
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors ${
                          !n.isRead ? 'bg-rose-50/70 dark:bg-rose-950/25' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{n.title}</span>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#E11D48] shrink-0" />}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">{n.message}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => handleNavClick('channel', user.uid)}
              aria-label="Open your channel"
              className="flex items-center gap-2 p-1 pr-2.5 rounded-xl bg-zinc-100 dark:bg-[#18181D] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
            >
              <MediaImage
                src={profile?.avatarUrl || user.photoURL || undefined}
                alt={profile?.displayName || 'Profile'}
                className="w-7 h-7 rounded-lg object-cover"
              />
              <span className="hidden md:inline text-xs font-medium text-zinc-900 dark:text-white max-w-[100px] truncate">
                {profile?.displayName || user.displayName || 'Account'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNavClick('login')}
              className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop & Tablet Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex pt-16' : 'hidden'
          } lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:flex w-60 shrink-0 flex-col justify-between bg-white dark:bg-[#09090B] border-r border-zinc-200 dark:border-zinc-800 px-3 py-4 overflow-y-auto transition-colors duration-200`}
        >
          <div className="space-y-5">
            <nav className="space-y-1">
              {primaryNav.map((item) => {
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#E11D48]/10 text-[#BE123C] dark:text-[#FB7185] border border-[#E11D48]/25 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                    }`}
                  >
                    <span className={active ? 'text-[#E11D48]' : ''}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Programs & Library
              </div>
              {communityNav.map((item) => {
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-orange-50 dark:bg-orange-950/30 text-[#EA580C] dark:text-[#FDBA74] font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={active ? 'text-[#EA580C]' : ''}>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#E11D48] text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Creator & Control
              </div>
              <button
                type="button"
                onClick={() => handleNavClick('studio')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  route === 'studio'
                    ? 'bg-orange-50 dark:bg-orange-950/30 text-[#EA580C] dark:text-[#FDBA74] font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${route === 'studio' ? 'text-[#EA580C]' : ''}`} />
                <span>Creator Studio</span>
              </button>

              {user && (
                <button
                  type="button"
                  onClick={() => handleNavClick('channel', user.uid)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    route === 'channel'
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>My Channel</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  route === 'settings'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    route === 'admin'
                      ? 'bg-[#E11D48]/10 text-[#BE123C] dark:text-[#FB7185] font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${route === 'admin' ? 'text-[#E11D48]' : ''}`} />
                  <span>Admin Control</span>
                </button>
              )}

              {isCeo && (
                <button
                  type="button"
                  onClick={() => handleNavClick('ceo-command')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                    route === 'ceo-command'
                      ? 'bg-gradient-to-r from-[#7F1D1D] to-[#DC2626] text-white shadow-sm'
                      : 'text-[#B91C1C] dark:text-[#F97316] bg-red-50 dark:bg-[#09090B] border border-red-200 dark:border-[#7F1D1D]/60 hover:bg-[#7F1D1D] hover:text-white'
                  }`}
                >
                  <Crown className="w-4 h-4 text-[#F97316]" />
                  <span>CEO Command Center</span>
                </button>
              )}
            </div>
          </div>

          <footer className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800 px-2 space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-[#141418] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium transition-colors"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                {theme === 'dark' ? (
                  <Moon className="w-3.5 h-3.5 text-[#F97316]" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-[#F97316]" />
                )}
                <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Switch</span>
            </button>

            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
              <button
                type="button"
                onClick={() => handleNavClick('about')}
                className="hover:text-zinc-900 dark:hover:text-white"
              >
                About
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('contact')}
                className="hover:text-zinc-900 dark:hover:text-white"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('privacy')}
                className="hover:text-zinc-900 dark:hover:text-white"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('terms')}
                className="hover:text-zinc-900 dark:hover:text-white"
              >
                Terms
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-1">India Creates. India Watches.</p>
          </footer>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 bg-white dark:bg-[#09090B] pb-20 md:pb-8 transition-colors duration-200">
          {isSuspended && (
            <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-4 md:px-8 py-2.5 flex items-center gap-3 text-xs text-red-900 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>
                Your account or channel is currently suspended. Uploads, live broadcasting, and public channel listings are disabled.
                {profile?.moderationReason ? ` Reason: ${profile.moderationReason}` : ''}
              </span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-5 items-center transition-colors duration-200"
      >
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            route === 'home' ? 'text-[#E11D48]' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('shorts')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            route === 'shorts' ? 'text-[#EA580C]' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Shorts</span>
        </button>

        <button
          type="button"
          onClick={onOpenUpload}
          className="flex flex-col items-center justify-center min-h-[44px] text-zinc-900 dark:text-white"
          aria-label="Upload video"
        >
          <span className="w-10 h-7 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] flex items-center justify-center">
            <PlusSquare className="w-4 h-4 text-white" />
          </span>
          <span className="text-[10px] font-medium mt-0.5 text-zinc-700 dark:text-zinc-300">Upload</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('watch-party')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            route === 'watch-party' ? 'text-[#EA580C]' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Party</span>
        </button>

        <button
          type="button"
          onClick={() => (user ? handleNavClick('channel', user.uid) : handleNavClick('login'))}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            route === 'channel' || route === 'login' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
