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
          <div className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316]">About BHARATPLAY</div>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-zinc-900 dark:text-white">
            India Creates. India Watches.
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
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
            <div key={item.title} className="p-5 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{item.title}</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.body}</p>
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
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900 dark:text-white">Contact Us</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Reach our Bengaluru creator support, trust & safety, or media partnerships desk.
          </p>
        </div>

        {ticketId ? (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <div className="text-base font-bold text-zinc-900 dark:text-white">Support Ticket Received</div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Reference ID: <span className="font-mono text-[#EA580C] dark:text-[#F97316] font-semibold">{ticketId}</span>. Our team will respond within 24 hours.
            </p>
            <button
              type="button"
              onClick={() => setTicketId('')}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#111115] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white"
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
            className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
              />
            </div>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
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
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <div>
          <div className="text-xs font-semibold text-[#EA580C] dark:text-[#F97316]">Legal & Trust Center</div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900 dark:text-white mt-1">
            Privacy Policy & Financial Data Isolation
          </h1>
        </div>
        <section className="space-y-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">1. Account & Payout Confidentiality</h2>
          <p>
            BHARATPLAY strictly isolates personal account credentials, email addresses, UPI payout identifiers, tax/settlement ledgers, and private moderation history from public channel profiles. Public visitors can browse published videos, Bharat Shorts, and creator channels without exposing any personal or financial details.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">2. Payment Verification & Gateway Security</h2>
          <p>
            No raw card numbers, UPI PINs, or payment gateway secrets are ever stored in frontend browser storage or client code. All financial transactions require server-side HMAC signature verification before a creator ledger credit becomes eligible for settlement.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">3. Discovery & Anti-Fraud Telemetry</h2>
          <p>
            Watch history, Watch Later lists, and privacy-respecting rate telemetry are used strictly to power Continue Watching, regional recommendations, and Invalid Traffic (IVT) protection against automated click farms or view bots.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
      <div>
        <div className="text-xs font-semibold text-[#E11D48] dark:text-[#FB7185]">BHARATPLAY Partner Governance</div>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-zinc-900 dark:text-white mt-1">
          Terms, Creator Monetization & Payment Rules
        </h1>
      </div>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">1. Content Ownership & Distribution License</h2>
        <p>
          Creators retain full ownership of original videos, Bharat Shorts, paid series, membership perks, and live broadcasts published on BHARATPLAY. By publishing, you grant BHARATPLAY a non-exclusive license to stream and distribute your content across the platform.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">2. Revenue Sharing & Real vs. Estimated Balances</h2>
        <p>
          Platform-wide revenue shares (default 75% ad share, 85% memberships, 95% creator support, and 85% paid videos) are governed transparently in Creator Studio. Projected metrics or unverified analytics NEVER appear as withdrawable balances. Only settled, server-verified transactions in your Available Balance are eligible for UPI payout requests once you meet the minimum payout threshold (default ₹500).
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">3. Payment Gateway Staging & Refunds</h2>
        <p>
          Real-money Creator Support, Memberships, and Paid Video unlocks remain disabled until live payment gateway credentials and backend signature verification are configured. Disputed transactions, unauthorized charges, or undelivered paid/brand deliverables may be flagged via the Payment Dispute desk and audited permanently by BHARATPLAY Governance.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">4. Zero Tolerance for Invalid Traffic (IVT)</h2>
        <p>
          Automated view bots, click-farm loops, artificial ad impressions, and self-click affiliate manipulation are strictly prohibited. Confirmed invalid traffic results in immediate revenue clawbacks, suspension of monetization eligibility, and permanent audit logging.
        </p>
      </section>
    </div>
  );
}
