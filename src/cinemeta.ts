import type { ContentType, MetaDetail, MetaPreview } from './types';

/**
 * Cinemeta is the metadata addon that is always installed in Stremio.
 * We read its public, key-less HTTP API at build time so the generated
 * static files carry exactly the same metadata Stremio would show anyway.
 */
const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates that a Cinemeta response is a meta object for the expected
 * IMDb id and content type, then passes it through unchanged.
 */
export function parseMetaDetail(raw: unknown, type: ContentType, imdbId: string): MetaDetail {
  if (!isRecord(raw) || raw.id !== imdbId || raw.type !== type || typeof raw.name !== 'string') {
    throw new Error(`Cinemeta returned invalid meta for ${type}/${imdbId}`);
  }
  return raw as MetaDetail;
}

/** Fetches full meta (including series episodes) from Cinemeta. */
export async function fetchMetaDetail(type: ContentType, imdbId: string): Promise<MetaDetail> {
  const url = `${CINEMETA_BASE_URL}/meta/${type}/${imdbId}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cinemeta GET ${url} failed with HTTP ${response.status}`);
  }
  const raw: unknown = await response.json();
  const payload = isRecord(raw) ? raw.meta : undefined;
  return parseMetaDetail(payload, type, imdbId);
}

/**
 * Reduces a full meta object to the preview fields used in catalog rows,
 * keeping catalog responses small (no episode lists, cast, or trailers).
 */
export function toMetaPreview(meta: MetaDetail): MetaPreview {
  return {
    id: meta.id,
    type: meta.type,
    name: meta.name,
    poster: meta.poster,
    posterShape: meta.posterShape,
    background: meta.background,
    description: meta.description,
    releaseInfo: meta.releaseInfo,
    imdbRating: meta.imdbRating,
    runtime: meta.runtime,
    genres: meta.genres,
  };
}
