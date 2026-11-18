import React, { useState } from 'react';
import { Play, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { DEFAULT_LANGUAGES } from '../lib/catalogSeed';
import type { AppRoute } from '../types/bharatplay';

interface AuthPagesProps {
  mode: 'login' | 'signup';
  onNavigate: (route: AppRoute) => void;
}

export function AuthPages({ mode, onNavigate }: AuthPagesProps) {
  const { signInWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  const { showToast } = useToast();

  const [view, setView] = useState<'login' | 'signup' | 'forgot'>(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asCreator, setAsCreator] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState('Hindi');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      showToast('Welcome to BHARATPLAY!', 'success');
      onNavigate('home');
    } catch (err: any) {
      showToast(err?.message || 'Google Sign-In failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === 'forgot') {
        await resetPassword(email);
        showToast('Password reset link sent to your email.', 'success');
        setView('login');
      } else if (view === 'signup') {
        await registerWithEmail(name, email, password, asCreator, preferredLanguage);
        showToast('Account created! Check your inbox to verify your email.', 'success');
        onNavigate('home');
      } else {
        await loginWithEmail(email, password);
        showToast('Signed in to BHARATPLAY!', 'success');
        onNavigate('home');
      }
    } catch (err: any) {
      showToast(err?.message || 'Authentication failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 bg-zinc-50/60 dark:bg-[#09090B] transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E11D48] to-[#F97316] flex items-center justify-center">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </span>
            <span className="font-display font-extrabold text-xl text-zinc-900 dark:text-white">
              BHARAT<span className="text-[#EA580C] dark:text-[#F97316]">PLAY</span>
            </span>
          </div>
          <h1 className="text-xl font-bold font-display text-zinc-900 dark:text-white">
            {view === 'login' && 'Sign in to your account'}
            {view === 'signup' && 'Create your BharatPlay channel'}
            {view === 'forgot' && 'Reset your password'}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">India Creates. India Watches.</p>
        </div>

        {view !== 'forgot' && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 dark:bg-[#141418] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span>or with email</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name / Channel Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#E11D48]"
              />
            </div>
          </div>

          {view !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                {view === 'login' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs text-[#EA580C] dark:text-[#F97316] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
            </div>
          )}

          {view === 'signup' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Preferred Language</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
                >
                  {DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages').map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={asCreator}
                  onChange={(e) => setAsCreator(e.target.checked)}
                  className="rounded accent-[#E11D48]"
                />
                <span>Enable Creator Account & Early Creator Program</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : view === 'login'
              ? 'Sign In'
              : view === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          {view === 'login' ? (
            <>
              New to BHARATPLAY?{' '}
              <button type="button" onClick={() => setView('signup')} className="text-[#EA580C] dark:text-[#F97316] font-semibold hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setView('login')} className="text-[#EA580C] dark:text-[#F97316] font-semibold hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
