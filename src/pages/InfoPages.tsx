import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useToast } from '../components/Toast';
import type { AppRoute } from '../types/bharatplay';

interface InfoPagesProps {
  page: 'about' | 'contact' | 'privacy' | 'terms';
  onNavigate: (route: AppRoute) => void;
}

export function InfoPages({ page, onNavigate }: InfoPagesProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Creator Partnerships');
  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState('');

  if (page === 'about') {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[#EA580C]">About BHARATPLAY</div>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-zinc-900">
            India Creates. India Watches.
          </h1>
          <p className="text-base text-zinc-600 leading-relaxed">
            BHARATPLAY is built in India for independent storytellers, educators, musicians, technologists, and regional voices across every state and language.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: 'Creator-First Economics',
              body: '75% revenue share, zero-threshold Creator Support contributions, and milestone rewards through BharatPlay Rewards.',
            },
            {
              title: 'Creator Boost & League',
              body: 'Quality-first discovery for emerging channels and monthly Creator League championships ranked by genuine audience engagement.',
            },
            {
              title: 'Regional India',
              body: 'First-class support for Hindi, English, Punjabi, Rajasthani, Tamil, Telugu, Bengali, Marathi, and more.',
            },
          ].map((item) => (
            <div key={item.title} className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
              <h2 className="text-sm font-bold text-zinc-900">{item.title}</h2>
              <p className="text-xs text-zinc-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('explore')}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white"
        >
          Explore Indian Creators
        </button>
      </div>
    );
  }

  if (page === 'contact') {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900">Contact Us</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Reach our Bengaluru creator support, trust & safety, or media partnerships desk.
          </p>
        </div>

        {ticketId ? (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="text-base font-bold text-zinc-900">Support Ticket Received</div>
            <p className="text-sm text-zinc-700">
              Reference ID: <span className="font-mono text-[#EA580C] font-semibold">{ticketId}</span>. Our team will respond within 24 hours.
            </p>
            <button
              type="button"
              onClick={() => setTicketId('')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold text-zinc-900"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, topic, message }),
              });
              const data = await res.json();
              if (res.ok) {
                setTicketId(data.ticketId);
                setMessage('');
                showToast('Message sent to BharatPlay Support.', 'success');
              } else {
                showToast(data.error || 'Could not send message.', 'error');
              }
            }}
            className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900"
            >
              <option>Creator Partnerships</option>
              <option>Monetization & Payouts</option>
              <option>Trust & Safety</option>
              <option>Technical Support</option>
            </select>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-300 text-sm text-zinc-900 placeholder-zinc-400"
            />
            <button type="submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white">
              <Send className="w-4 h-4" />
              <span>Submit Inquiry</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  if (page === 'privacy') {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-5 text-sm text-zinc-700 leading-relaxed">
        <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900">Privacy Policy</h1>
        <p>
          BHARATPLAY isolates personal account credentials, email addresses, and payout identifiers from public channel profiles. Public visitors can browse published videos, Bharat Shorts, and channel profiles without exposing personal contact details.
        </p>
        <p>
          Watch history and Watch Later lists are stored strictly under your private user scope to power Continue Watching and Smart Discovery recommendations. You may update your preferred language, notification settings, or account details anytime under Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-5 text-sm text-zinc-700 leading-relaxed">
      <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900">Terms & Conditions</h1>
      <p>
        Creators retain ownership of original videos, Bharat Shorts, audio tracks, and live broadcasts published on BHARATPLAY. By publishing, you grant BHARATPLAY a non-exclusive license to stream and distribute your content across the platform.
      </p>
      <p>
        Harassment, impersonation, copyright infringement, artificial view inflation, and spam are prohibited. Users may report policy violations directly from any video watch page for prompt review by our Moderation team.
      </p>
    </div>
  );
}
