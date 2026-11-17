import type { CeoOverviewResponse } from '../types/bharatplay';

export class CeoReauthRequiredError extends Error {
  code = 'CEO_REAUTH_REQUIRED';
  constructor(message: string) {
    super(message);
    this.name = 'CeoReauthRequiredError';
  }
}

async function ceoFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 428 || data?.code === 'CEO_REAUTH_REQUIRED') {
    throw new CeoReauthRequiredError(
      data?.error || 'Additional CEO re-authentication required for this sensitive action.'
    );
  }

  if (!res.ok) {
    throw new Error(data?.error || `CEO request failed (${res.status})`);
  }

  return data as T;
}

export async function fetchCeoOverview(token: string): Promise<CeoOverviewResponse> {
  return ceoFetch<CeoOverviewResponse>('/api/ceo/overview', token, { method: 'GET' });
}

export async function executeCeoChannelAction(
  token: string,
  payload: {
    action: 'suspend_channel' | 'restore_channel' | 'soft_delete_channel' | 'permanent_delete_channel';
    targetUid: string;
    reason: string;
    confirmPhrase?: string;
  }
) {
  return ceoFetch<{ ok: boolean; details: string }>('/api/ceo/channels/action', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeCeoVideoAction(
  token: string,
  payload: {
    action: 'soft_remove' | 'restore' | 'permanent_delete';
    videoId: string;
    reason: string;
    confirmPhrase?: string;
  }
) {
  return ceoFetch<{ ok: boolean; details: string }>('/api/ceo/videos/action', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeCeoUserAction(
  token: string,
  payload: {
    action:
      | 'suspend_account'
      | 'reactivate_account'
      | 'soft_delete_account'
      | 'permanent_delete_account'
      | 'set_creator_permission'
      | 'set_admin_permission'
      | 'set_verification'
      | 'set_featured'
      | 'set_rising_creator';
    targetUid: string;
    reason: string;
    value?: boolean;
    confirmPhrase?: string;
  }
) {
  return ceoFetch<{ ok: boolean; details: string }>('/api/ceo/users/action', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeCeoReportAction(
  token: string,
  payload: {
    reportId: string;
    status: 'reviewed' | 'resolved' | 'dismissed';
    reason: string;
    alsoSoftRemoveTarget?: boolean;
  }
) {
  return ceoFetch<{ ok: boolean }>('/api/ceo/reports/action', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeCeoAnnouncementAction(
  token: string,
  payload: {
    action: 'publish' | 'toggle' | 'delete';
    announcementId?: string;
    title?: string;
    body?: string;
    category?: 'feature' | 'league' | 'policy' | 'event';
    isActive?: boolean;
  }
) {
  return ceoFetch<{ ok: boolean; id: string }>('/api/ceo/announcements', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
