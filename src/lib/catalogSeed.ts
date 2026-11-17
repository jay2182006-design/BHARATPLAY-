import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  CreatorChallenge,
  CommunityPost,
  LeagueCompetition,
  LiveStream,
  PlatformAnnouncement,
  PlatformConfig,
  UserPublicProfile,
  VideoItem,
} from '../types/bharatplay';

export const DEFAULT_CATEGORIES = [
  'All',
  'Tech',
  'Food & Travel',
  'Music',
  'Education',
  'Comedy',
  'Gaming',
  'Cinema',
  'Regional',
  'News',
];

export const DEFAULT_LANGUAGES = [
  'All Languages',
  'Hindi',
  'English',
  'Punjabi',
  'Rajasthani',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Kannada',
  'Malayalam',
  'Gujarati',
];

export const REGIONAL_SPOTLIGHT_LANGUAGES = [
  'Hindi',
  'English',
  'Punjabi',
  'Rajasthani',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
] as const;

export const SEED_CREATORS: Omit<UserPublicProfile, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'creator_arjun_silicon',
    uid: 'creator_arjun_silicon',
    displayName: 'Arjun Nair Tech',
    handle: 'arjunnairtech',
    bio: 'Hardware deep-dives, Bengaluru semiconductor stories, and honest Indian consumer tech reviews.',
    avatarUrl: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    bannerUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    isCreator: true,
    isEarlyCreator: false,
    isVerified: true,
    isFeatured: true,
    boostEnabled: false,
    leagueCategory: 'Education',
    preferredLanguage: 'English',
    subscribersCount: 482000,
    totalViews: 14200000,
    rewardTier: 'Icon',
  },
  {
    id: 'creator_mumbai_zaika',
    uid: 'creator_mumbai_zaika',
    displayName: 'Mumbai Zaika Chronicles',
    handle: 'mumbaizaika',
    bio: 'Midnight street food documentaries across Maharashtra, Gujarat, and Old Delhi.',
    avatarUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    bannerUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: true,
    isFeatured: true,
    boostEnabled: true,
    leagueCategory: 'Entertainment',
    preferredLanguage: 'Hindi',
    subscribersCount: 318500,
    totalViews: 9650000,
    rewardTier: 'Star',
  },
  {
    id: 'creator_kabir_sounds',
    uid: 'creator_kabir_sounds',
    displayName: 'Kabir Raga Collective',
    handle: 'kabirragas',
    bio: 'Blending classical Hindustani sitar with analog modular synths from Pune.',
    avatarUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    bannerUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: true,
    isFeatured: true,
    boostEnabled: true,
    leagueCategory: 'Rising Star',
    preferredLanguage: 'Hindi',
    subscribersCount: 194000,
    totalViews: 5300000,
    rewardTier: 'Rising',
  },
  {
    id: 'creator_ladakh_trails',
    uid: 'creator_ladakh_trails',
    displayName: 'Vikram Mountain Trails',
    handle: 'vikramtrails',
    bio: 'Solo high-altitude motorcycle expeditions across Spiti, Zanskar, and Arunachal.',
    avatarUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    bannerUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    isCreator: true,
    isEarlyCreator: false,
    isVerified: true,
    isFeatured: true,
    boostEnabled: false,
    leagueCategory: 'Entertainment',
    preferredLanguage: 'English',
    subscribersCount: 625000,
    totalViews: 21400000,
    rewardTier: 'Icon',
  },
  {
    id: 'creator_jaipur_folk',
    uid: 'creator_jaipur_folk',
    displayName: 'Marwar Folk Studio',
    handle: 'marwarfolk',
    bio: 'Archiving Rajasthani Manganiyar acoustics, desert architecture, and textile artisans.',
    avatarUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    bannerUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: false,
    isFeatured: true,
    boostEnabled: true,
    leagueCategory: 'Rising Star',
    preferredLanguage: 'Rajasthani',
    subscribersCount: 42800,
    totalViews: 890000,
    rewardTier: 'Rising',
  },
  {
    id: 'creator_amritsar_kitchen',
    uid: 'creator_amritsar_kitchen',
    displayName: 'Amritsar Heritage Table',
    handle: 'amritsartable',
    bio: 'Punjabi culinary stories, tandoor craft, and harvest festivals from Punjab.',
    avatarUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    bannerUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: true,
    isFeatured: false,
    boostEnabled: true,
    leagueCategory: 'Entertainment',
    preferredLanguage: 'Punjabi',
    subscribersCount: 78500,
    totalViews: 1740000,
    rewardTier: 'Rising',
  },
  {
    id: 'creator_hyderabad_science',
    uid: 'creator_hyderabad_science',
    displayName: 'Deccan Science Lab',
    handle: 'deccansciencelab',
    bio: 'Clear, visual engineering and aerospace explainers in Telugu and English.',
    avatarUrl: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    bannerUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: true,
    isFeatured: true,
    boostEnabled: true,
    leagueCategory: 'Education',
    preferredLanguage: 'Telugu',
    subscribersCount: 112000,
    totalViews: 2650000,
    rewardTier: 'Star',
  },
  {
    id: 'creator_kolkata_cinema',
    uid: 'creator_kolkata_cinema',
    displayName: 'Hooghly Film Collective',
    handle: 'hooghlyfilm',
    bio: 'Bengali independent cinema essays, sound design breakdowns, and city chronicles.',
    avatarUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    bannerUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    isCreator: true,
    isEarlyCreator: true,
    isVerified: false,
    isFeatured: false,
    boostEnabled: true,
    leagueCategory: 'Education',
    preferredLanguage: 'Bengali',
    subscribersCount: 36400,
    totalViews: 620000,
    rewardTier: 'Seed',
  },
];

export const SEED_VIDEOS: Omit<VideoItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'vid_bengaluru_silicon',
    creatorId: 'creator_arjun_silicon',
    creatorName: 'Arjun Nair Tech',
    creatorAvatar: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    title: 'Inside India’s First RISC-V Edge AI Chip Lab in Bengaluru',
    description:
      'We toured a Bengaluru hardware lab designing low-power RISC-V silicon for Indian smart grids, UPI terminals, and edge cameras. Full thermal benchmarks and architecture breakdown included.',
    videoUrl: '/api/media/videos/tech_india_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    type: 'video',
    category: 'Education',
    language: 'English',
    durationSeconds: 8,
    tags: ['Bengaluru', 'Hardware', 'RISCV', 'IndiaTech'],
    chapters: [
      { timeSeconds: 0, title: 'Lab Tour & Cleanroom Entry' },
      { timeSeconds: 3, title: 'RISC-V Architecture Benchmarks' },
      { timeSeconds: 6, title: 'India Deployment Roadmap' },
    ],
    viewsCount: 284500,
    uniqueViewersCount: 241000,
    totalWatchSeconds: 1820000,
    likesCount: 19200,
    dislikesCount: 210,
    commentsCount: 4,
    sharesCount: 1840,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: false,
    isOriginal: true,
  },
  {
    id: 'vid_mumbai_midnight_chai',
    creatorId: 'creator_mumbai_zaika',
    creatorName: 'Mumbai Zaika Chronicles',
    creatorAvatar: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    title: '3 AM at Mohammed Ali Road: Iron Griddle Pav Bhaji & Irani Chai',
    description:
      'A cinematic night documentary capturing the cooks, spice blends, and stories behind Mumbai’s iconic late-night street kitchens.',
    videoUrl: '/api/media/videos/street_food_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    type: 'video',
    category: 'Food & Travel',
    language: 'Hindi',
    durationSeconds: 8,
    tags: ['Mumbai', 'StreetFood', 'Chai', 'Documentary'],
    chapters: [
      { timeSeconds: 0, title: 'Midnight Prep in South Mumbai' },
      { timeSeconds: 3, title: 'The Heritage Iron Tawa' },
      { timeSeconds: 6, title: 'Irani Chai Pour & Stories' },
    ],
    viewsCount: 412000,
    uniqueViewersCount: 368000,
    totalWatchSeconds: 2636800,
    likesCount: 34800,
    dislikesCount: 145,
    commentsCount: 3,
    sharesCount: 2910,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: true,
    isOriginal: true,
  },
  {
    id: 'vid_pune_sitar_synth',
    creatorId: 'creator_kabir_sounds',
    creatorName: 'Kabir Raga Collective',
    creatorAvatar: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    title: 'Raag Yaman on Electric Sitar & Moog Analog Synth (Live Studio Session)',
    description:
      'Recorded live in one take at our Pune acoustic loft. Combining midnight Raag Yaman phrases with warm analog tape delay.',
    videoUrl: '/api/media/videos/indie_music_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    type: 'video',
    category: 'Music',
    language: 'Hindi',
    durationSeconds: 8,
    musicTrack: 'Raag Yaman Tape Session — Kabir Raga Collective',
    tags: ['IndieMusic', 'Sitar', 'Pune', 'ClassicalFusion'],
    chapters: [
      { timeSeconds: 0, title: 'Alap on Electric Sitar' },
      { timeSeconds: 4, title: 'Analog Bassline Entry' },
      { timeSeconds: 6, title: 'Modular Synth Crescendo' },
    ],
    viewsCount: 168900,
    uniqueViewersCount: 149000,
    totalWatchSeconds: 1120000,
    likesCount: 15600,
    dislikesCount: 64,
    commentsCount: 2,
    sharesCount: 1120,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: true,
    isOriginal: true,
  },
  {
    id: 'vid_ladakh_umling_la',
    creatorId: 'creator_ladakh_trails',
    creatorName: 'Vikram Mountain Trails',
    creatorAvatar: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    title: 'Sunrise Above the Clouds: Solo Ride Across Ladakh’s Highest Pass',
    description:
      'Crossing 18,000 feet at dawn with sub-zero winds, crisp Himalayan ridges, and zero traffic for 90 kilometers.',
    videoUrl: '/api/media/videos/himalayas_vlog_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    type: 'video',
    category: 'Food & Travel',
    language: 'English',
    durationSeconds: 8,
    tags: ['Ladakh', 'Himalayas', 'MotoVlog', 'TravelIndia'],
    chapters: [
      { timeSeconds: 0, title: 'Pre-Dawn Ascent' },
      { timeSeconds: 3, title: 'Ridge Traverse at 18,000 ft' },
      { timeSeconds: 6, title: 'Sunrise Over the Valley' },
    ],
    viewsCount: 529000,
    uniqueViewersCount: 472000,
    totalWatchSeconds: 3590000,
    likesCount: 41200,
    dislikesCount: 310,
    commentsCount: 3,
    sharesCount: 4100,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: false,
    isOriginal: true,
  },
  {
    id: 'vid_jaipur_desert_strings',
    creatorId: 'creator_jaipur_folk',
    creatorName: 'Marwar Folk Studio',
    creatorAvatar: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    title: 'Echoes of Jaisalmer: Live Kamaycha & Khartal Folk Acoustic Film',
    description:
      'Recorded under winter starlight in western Rajasthan with third-generation folk instrumentalists preserving Marwari ballads.',
    videoUrl: '/api/media/videos/indie_music_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    type: 'video',
    category: 'Regional',
    language: 'Rajasthani',
    durationSeconds: 8,
    tags: ['Rajasthani', 'Marwar', 'FolkMusic', 'Jaisalmer'],
    chapters: [
      { timeSeconds: 0, title: 'Sand Dune Acoustic Setup' },
      { timeSeconds: 4, title: 'Kamaycha Solo Improvisation' },
    ],
    viewsCount: 94200,
    uniqueViewersCount: 84500,
    totalWatchSeconds: 640000,
    likesCount: 11800,
    dislikesCount: 32,
    commentsCount: 2,
    sharesCount: 960,
    status: 'published',
    isTrending: false,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
  {
    id: 'vid_amritsar_kulcha_craft',
    creatorId: 'creator_amritsar_kitchen',
    creatorName: 'Amritsar Heritage Table',
    creatorAvatar: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    title: 'Clay Oven Mastery: Inside a 90-Year-Old Amritsari Kulcha Bakery',
    description:
      'From hand-folded flaky dough layers to sizzling white butter on charcoal embers — a Punjabi culinary heritage story.',
    videoUrl: '/api/media/videos/street_food_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    type: 'video',
    category: 'Food & Travel',
    language: 'Punjabi',
    durationSeconds: 8,
    tags: ['Punjabi', 'Amritsar', 'HeritageFood'],
    chapters: [
      { timeSeconds: 0, title: 'Morning Tandoor Firing' },
      { timeSeconds: 4, title: 'Layered Dough Technique' },
    ],
    viewsCount: 138400,
    uniqueViewersCount: 121000,
    totalWatchSeconds: 890000,
    likesCount: 14200,
    dislikesCount: 41,
    commentsCount: 2,
    sharesCount: 840,
    status: 'published',
    isTrending: false,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
  {
    id: 'vid_hyderabad_orbit_lab',
    creatorId: 'creator_hyderabad_science',
    creatorName: 'Deccan Science Lab',
    creatorAvatar: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    title: 'How India’s Private Micro-Satellite Propulsion Systems Work (Telugu + Visuals)',
    description:
      'Breaking down green bipropellant thrusters, cryogenic test stands, and orbital telemetry from Hyderabad’s space corridor.',
    videoUrl: '/api/media/videos/tech_india_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    type: 'video',
    category: 'Education',
    language: 'Telugu',
    durationSeconds: 8,
    tags: ['Telugu', 'SpaceTech', 'Hyderabad', 'Education'],
    chapters: [
      { timeSeconds: 0, title: 'Propulsion Physics Overview' },
      { timeSeconds: 4, title: 'Static Fire Telemetry' },
    ],
    viewsCount: 184300,
    uniqueViewersCount: 162000,
    totalWatchSeconds: 1290000,
    likesCount: 18900,
    dislikesCount: 54,
    commentsCount: 2,
    sharesCount: 1510,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: true,
    isOriginal: true,
  },
  {
    id: 'vid_kolkata_soundscapes',
    creatorId: 'creator_kolkata_cinema',
    creatorName: 'Hooghly Film Collective',
    creatorAvatar: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    title: 'Soundscapes of North Kolkata: Foley, Trams & Satyajit Ray Framing',
    description:
      'An atmospheric Bengali video essay exploring natural acoustic layering and classic handheld cinema techniques.',
    videoUrl: '/api/media/videos/indie_music_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    type: 'video',
    category: 'Cinema',
    language: 'Bengali',
    durationSeconds: 8,
    tags: ['Bengali', 'Cinema', 'Kolkata', 'FilmMaking'],
    chapters: [
      { timeSeconds: 0, title: 'Ambient Tram Recordings' },
      { timeSeconds: 4, title: 'Monsoon Lighting Framing' },
    ],
    viewsCount: 68900,
    uniqueViewersCount: 59400,
    totalWatchSeconds: 472000,
    likesCount: 8400,
    dislikesCount: 19,
    commentsCount: 1,
    sharesCount: 610,
    status: 'published',
    isTrending: false,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
  {
    id: 'short_ladakh_dawn',
    creatorId: 'creator_ladakh_trails',
    creatorName: 'Vikram Mountain Trails',
    creatorAvatar: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    title: 'First Light Over Zanskar Switchbacks #Himalayas',
    description: '60 seconds of pure Himalayan silence at 5:45 AM.',
    videoUrl: '/api/media/videos/short_ladakh_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_himalayas_vlog_1794912702886.jpg',
    type: 'short',
    category: 'Food & Travel',
    language: 'Hindi',
    durationSeconds: 8,
    musicTrack: 'Mountain Dawn Ambient — BharatPlay Audio',
    tags: ['Zanskar', 'Shorts', 'Ladakh'],
    viewsCount: 890000,
    uniqueViewersCount: 740000,
    totalWatchSeconds: 5100000,
    likesCount: 74200,
    dislikesCount: 420,
    commentsCount: 2,
    sharesCount: 3800,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
  {
    id: 'short_mumbai_tawa',
    creatorId: 'creator_mumbai_zaika',
    creatorName: 'Mumbai Zaika Chronicles',
    creatorAvatar: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    title: '60-Second Butter Masala Pav Rush in South Mumbai',
    description: 'Watch how 40 plates get served in under two minutes.',
    videoUrl: '/api/media/videos/short_mumbai_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    type: 'short',
    category: 'Food & Travel',
    language: 'Marathi',
    durationSeconds: 8,
    musicTrack: 'Bambai Night Groove — Street Beat',
    tags: ['MumbaiFood', 'PavBhaji', 'Shorts'],
    viewsCount: 645000,
    uniqueViewersCount: 580000,
    totalWatchSeconds: 3900000,
    likesCount: 51900,
    dislikesCount: 190,
    commentsCount: 1,
    sharesCount: 2240,
    status: 'published',
    isTrending: true,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
  {
    id: 'short_sitar_loop',
    creatorId: 'creator_kabir_sounds',
    creatorName: 'Kabir Raga Collective',
    creatorAvatar: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    title: 'Looping Electric Sitar + Modular Bass in 30 Seconds',
    description: 'Built from scratch with a single analog clock.',
    videoUrl: '/api/media/videos/short_sitar_demo.mp4',
    thumbnailUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    type: 'short',
    category: 'Music',
    language: 'Tamil',
    durationSeconds: 8,
    musicTrack: 'Carnatic Synth Arpeggio — Kabir Raga',
    tags: ['SitarLoop', 'IndieIndia', 'MusicShorts'],
    viewsCount: 312000,
    uniqueViewersCount: 274000,
    totalWatchSeconds: 1850000,
    likesCount: 29400,
    dislikesCount: 85,
    commentsCount: 1,
    sharesCount: 1320,
    status: 'published',
    isTrending: false,
    isEarlyCreatorSpotlight: true,
    isOriginal: false,
  },
];

export const SEED_LIVE_STREAMS: Omit<LiveStream, 'startedAt'>[] = [
  {
    id: 'live_bengaluru_hardware',
    creatorId: 'creator_arjun_silicon',
    creatorName: 'Arjun Nair Tech',
    creatorAvatar: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    title: 'LIVE Q&A: Building Open-Source AI Hardware in India (2026 Roadmap)',
    description: 'Live interactive hardware teardown, PCB inspection, and Q&A for Indian embedded engineers and students.',
    category: 'Tech',
    language: 'English',
    thumbnailUrl: '/src/assets/images/thumb_tech_india_1794912701310.jpg',
    streamUrl: '/api/media/videos/tech_india_demo.mp4',
    isLive: true,
    viewerCount: 1420,
  },
  {
    id: 'live_pune_raga_jam',
    creatorId: 'creator_kabir_sounds',
    creatorName: 'Kabir Raga Collective',
    creatorAvatar: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    title: 'Midnight Acoustic & Synth Jam — Request Your Raag in Chat',
    description: 'Live audience-requested fusion improvisations from Pune.',
    category: 'Music',
    language: 'Hindi',
    thumbnailUrl: '/src/assets/images/thumb_indie_music_1794912702449.jpg',
    streamUrl: '/api/media/videos/indie_music_demo.mp4',
    isLive: true,
    viewerCount: 864,
  },
];

export const SEED_COMMUNITY_POSTS: Omit<CommunityPost, 'createdAt'>[] = [
  {
    id: 'post_arjun_poll_1',
    creatorId: 'creator_arjun_silicon',
    creatorName: 'Arjun Nair Tech',
    creatorAvatar: '/src/assets/images/creator_avatar_lead_1794912702305.jpg',
    content: 'Which Indian deep-tech startup lab should we film next month for our 4K documentary series?',
    imageUrl: '',
    postType: 'poll',
    pollOptions: ['Agnikul Rocket Propulsion (Chennai)', 'Bengaluru Drone Robotics', 'Hyderabad EV Battery Lab', 'Pune Quantum Photonics'],
    pollVotes: [412, 289, 355, 198],
    likesCount: 640,
  },
  {
    id: 'post_mumbai_zaika_1',
    creatorId: 'creator_mumbai_zaika',
    creatorName: 'Mumbai Zaika Chronicles',
    creatorAvatar: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    content: 'Thank you BharatPlay community! Our Mohammed Ali Road midnight documentary just crossed 4 Lakh views with 100% creator ad-share unlocked.',
    imageUrl: '/src/assets/images/thumb_street_food_1794912701606.jpg',
    postType: 'announcement',
    pollOptions: [],
    pollVotes: [],
    likesCount: 920,
  },
];

export const SEED_CHALLENGES: Omit<CreatorChallenge, 'createdAt'>[] = [
  {
    id: 'challenge_monsoon_stories',
    title: 'Incredible Local Stories — 60s Short Film Challenge',
    description: 'Capture a hyper-local craftsperson, street musician, or neighborhood story in your regional language under 60 seconds.',
    prizePoolInr: 150000,
    category: 'Regional',
    deadline: '2026-12-01',
    participantsCount: 342,
    status: 'active',
  },
  {
    id: 'challenge_indie_sound',
    title: 'Swadeshi Soundscape — Original Fusion Track',
    description: 'Blend any classical Indian instrument with electronic production and publish a live session.',
    prizePoolInr: 100000,
    category: 'Music',
    deadline: '2026-12-15',
    participantsCount: 189,
    status: 'active',
  },
];

export const SEED_COMPETITIONS: Omit<LeagueCompetition, 'createdAt'>[] = [
  {
    id: 'league_nov_2026',
    title: 'BharatPlay Creator League — Season 4',
    monthLabel: 'November 2026',
    description: 'Monthly creator championship ranked transparently by organic engagement rate, watch-time retention, and community appreciation across Education, Entertainment, and Rising Star tracks.',
    prizePoolInr: 500000,
    categories: ['Best Educational Creator', 'Best Entertainment Creator', 'Rising Star'],
    winnerCreatorId: '',
    winnerCreatorName: '',
    status: 'active',
  },
];

export const SEED_ANNOUNCEMENTS: Omit<PlatformAnnouncement, 'createdAt'>[] = [
  {
    id: 'ann_creator_league_s4',
    title: 'BharatPlay Creator League Season 4 & Watch Party Rooms Live',
    body: 'Host private synchronized Watch Parties with friends, climb the monthly Creator League leaderboard, and collaborate directly with creators across 8 regional languages.',
    category: 'feature',
    createdBy: 'BHARATPLAY Team',
    isActive: true,
  },
  {
    id: 'ann_boost_discovery',
    title: 'Creator Boost Program: Quality-First Discovery',
    body: 'New channels with strong viewer retention and authentic engagement automatically surface in Creator Boost without pay-to-play inflation.',
    category: 'league',
    createdBy: 'BHARATPLAY Team',
    isActive: true,
  },
];

export const DEFAULT_PLATFORM_CONFIG: Omit<PlatformConfig, 'updatedAt'> = {
  categories: DEFAULT_CATEGORIES.filter((c) => c !== 'All'),
  languages: DEFAULT_LANGUAGES.filter((l) => l !== 'All Languages'),
  earlyCreatorBoostEnabled: true,
  creatorRevenueSharePercent: 75,
  maintenanceMode: false,
};

let seedingAttempted = false;

export async function ensureAdminSeededCatalog(isAdminUser: boolean): Promise<void> {
  if (!isAdminUser || seedingAttempted) return;
  seedingAttempted = true;
  try {
    const configRef = doc(db, 'platformConfig', 'settings');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        ...DEFAULT_PLATFORM_CONFIG,
        updatedAt: serverTimestamp(),
      });
    }

    for (const c of SEED_CREATORS) {
      const ref = doc(db, 'users', c.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = c;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const v of SEED_VIDEOS) {
      const ref = doc(db, 'videos', v.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = v;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const s of SEED_LIVE_STREAMS) {
      const ref = doc(db, 'liveStreams', s.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = s;
        await setDoc(ref, {
          ...payload,
          startedAt: serverTimestamp(),
        });
      }
    }

    for (const p of SEED_COMMUNITY_POSTS) {
      const ref = doc(db, 'communityPosts', p.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = p;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    }

    for (const ch of SEED_CHALLENGES) {
      const ref = doc(db, 'challenges', ch.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = ch;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    }

    for (const comp of SEED_COMPETITIONS) {
      const ref = doc(db, 'competitions', comp.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = comp;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    }

    for (const ann of SEED_ANNOUNCEMENTS) {
      const ref = doc(db, 'announcements', ann.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...payload } = ann;
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.warn('Catalog seed skipped or partial:', err);
  }
}
