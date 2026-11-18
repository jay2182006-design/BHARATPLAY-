async function adminFetch<T>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Admin request failed (${res.status})`);
  }
  return data as T;
}

export async function adminApiUpdateCreatorFlags(
  token: string,
  targetUid: string,
  updates: {
    isFeatured?: boolean;
    isVerified?: boolean;
    boostEnabled?: boolean;
    isEarlyCreator?: boolean;
    leagueCategory?: string;
    rewardTier?: 'Seed' | 'Rising' | 'Star' | 'Icon';
  }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/creators/flags', token, {
    targetUid,
    updates,
  });
}

export async function adminApiUpdateVideoStatus(
  token: string,
  params: {
    videoId: string;
    status: 'published' | 'flagged' | 'removed';
    isTrending?: boolean;
    isOriginal?: boolean;
    removalReason?: string;
  }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/videos/status', token, params);
}

export async function adminApiResolveReport(
  token: string,
  reportId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  reason?: string
) {
  return adminFetch<{ ok: boolean }>('/api/admin/reports/resolve', token, {
    reportId,
    status,
    reason,
  });
}

export async function adminApiCreateCompetition(
  token: string,
  params: {
    title: string;
    monthLabel: string;
    description: string;
    prizePoolInr: number;
    categories?: string[];
  }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/competitions', token, {
    action: 'create_competition',
    ...params,
  });
}

export async function adminApiUpdateCompetition(
  token: string,
  compId: string,
  updates: { status?: 'active' | 'completed'; winnerCreatorId?: string; winnerCreatorName?: string }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/competitions', token, {
    action: 'update_competition',
    compId,
    ...updates,
  });
}

export async function adminApiCreateChallenge(
  token: string,
  params: {
    title: string;
    description: string;
    prizePoolInr: number;
    category: string;
    deadline: string;
  }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/competitions', token, {
    action: 'create_challenge',
    ...params,
  });
}

export async function adminApiCreateAnnouncement(
  token: string,
  params: {
    title: string;
    body: string;
    category: 'feature' | 'league' | 'policy' | 'event';
    createdBy: string;
  }
) {
  return adminFetch<{ ok: boolean }>('/api/admin/announcements', token, {
    action: 'create',
    ...params,
  });
}

export async function adminApiToggleAnnouncement(
  token: string,
  announcementId: string,
  isActive: boolean
) {
  return adminFetch<{ ok: boolean }>('/api/admin/announcements', token, {
    action: 'toggle',
    announcementId,
    isActive,
  });
}

export async function adminApiUpdateCategories(token: string, categories: string[]) {
  return adminFetch<{ ok: boolean; categories: string[] }>('/api/admin/categories', token, {
    categories,
  });
}
