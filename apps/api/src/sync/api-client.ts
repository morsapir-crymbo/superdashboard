import { CustomerApiConfig } from './types';

const JWT_PATH = '/v1/auth/login/jwt';
const LIMIT = 100;

interface JwtResponse {
  token?: string;
  access_token?: string;
  data?: { token?: string; access_token?: string };
}

function extractItems(json: Record<string, unknown>): Array<Record<string, unknown>> {
  const apiData = (json.api_data ?? json.data ?? null) as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null;
  const result =
    json.result ??
    (apiData && !Array.isArray(apiData) ? apiData.result : undefined) ??
    (apiData && !Array.isArray(apiData) ? apiData.trades : undefined) ??
    (apiData && !Array.isArray(apiData) ? apiData.deposits : undefined) ??
    (apiData && !Array.isArray(apiData) ? apiData.transfers : undefined) ??
    (apiData && !Array.isArray(apiData) ? apiData.withdrawals : undefined) ??
    json.trades ??
    json.deposits ??
    json.transfers ??
    json.withdrawals ??
    apiData ??
    [];
  return Array.isArray(result) ? result : [];
}

function joinApiUrl(baseUrl: string, path: string): URL {
  const normalizedBase = `${baseUrl.replace(/\/+$/, '')}/`;
  return new URL(path.startsWith('/') ? path.slice(1) : path, normalizedBase);
}

export async function getJwt(config: CustomerApiConfig): Promise<string> {
  const url = `${config.baseUrl}${JWT_PATH}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      username: config.username,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JWT failed ${res.status}: ${text}`);
  }
  const json = (await res.json()) as JwtResponse;
  const token =
    json.token ??
    json.access_token ??
    (json.data && (json.data.token ?? json.data.access_token));
  if (!token) throw new Error('JWT response missing token');
  return token;
}

function sortFieldForRecentUpdates(path: string): string {
  if (path.endsWith('/trades')) return 'updated_at';
  if (path.includes('/transfers')) return 'created_at';
  return 'updated_at';
}

function itemUpdatedAt(item: Record<string, unknown>): Date | null {
  const raw = item.updated_at ?? item.updatedAt ?? item.created_at ?? item.createdAt;
  return raw ? new Date(String(raw)) : null;
}

export async function fetchRecentUpdatedListAll(
  baseUrl: string,
  jwt: string,
  path: string,
  updatedAfter: Date,
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  let offset = 0;
  const sortField = sortFieldForRecentUpdates(path);

  while (true) {
    const u = joinApiUrl(baseUrl, path);
    u.searchParams.set('limit', String(LIMIT));
    u.searchParams.set('offset', String(offset));
    u.searchParams.set('skip', String(offset));
    u.searchParams.set('sync_mode', 'true');

    if (path.includes('/v3/')) {
      u.searchParams.set('sB', sortField);
      u.searchParams.set('sD', 'desc');
    } else if (path.endsWith('/trades')) {
      u.searchParams.set('sort_by', sortField);
      u.searchParams.set('sort_dir', 'DESC');
    }

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Updated list ${path} ${res.status}: ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const items = extractItems(json);
    if (items.length === 0) break;

    const recentItems = items.filter((item) => {
      const updatedAt = itemUpdatedAt(item);
      return updatedAt == null || updatedAt >= updatedAfter;
    });
    all.push(...recentItems);

    const lastItem = items[items.length - 1];
    const lastItemUpdatedAt = lastItem ? itemUpdatedAt(lastItem) : null;
    if (lastItemUpdatedAt && lastItemUpdatedAt < updatedAfter) break;
    if (items.length < LIMIT) break;
    offset += LIMIT;
  }

  return all;
}

export function toFiatAmount(
  amount: number,
  currencyName: string,
  quotes: Record<string, number>,
): number {
  if (!amount || !currencyName) return 0;
  const rate = quotes[currencyName.toUpperCase()];
  if (rate != null && rate > 0) return amount * rate;
  if (currencyName.toUpperCase() === 'USD') return amount;
  return amount;
}
