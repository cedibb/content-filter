/*
 * Minimal Stremio addon protocol types, covering only what this addon emits.
 * Shapes follow the official protocol docs (github.com/Stremio/stremio-addon-sdk/docs).
 */

/** Content types supported by this addon. */
export type ContentType = 'movie' | 'series';

/** Shape of the whitelist file `approved-content.json`. */
export interface Whitelist {
  movies: string[];
  series: string[];
}

/** The two content types this addon supports. */
export const CONTENT_TYPES: readonly ContentType[] = ['movie', 'series'] as const;

/** Maps a whitelist section name to its Stremio content type. */
export const TYPE_BY_SECTION: Readonly<Record<keyof Whitelist, ContentType>> = {
  movies: 'movie',
  series: 'series',
} as const;

/** Fields shown in catalog rows and detail pages. */
export type MetaPreview = {
  id: string;
  type: ContentType;
  name: string;
  poster?: string;
  posterShape?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  runtime?: string;
  genres?: string[];
};

/** Full meta object, as served by the `meta` resource. */
export type MetaDetail = MetaPreview & {
  year?: string;
  director?: string[];
  cast?: string[];
  videos?: unknown[];
  trailers?: unknown[];
  ratings?: unknown;
  links?: unknown[];
  behaviorHints?: Record<string, unknown>;
};

/** A single manifest resource entry (string shorthand or full object). */
export interface ManifestResource {
  name: 'catalog' | 'meta';
  types?: ContentType[];
  idPrefixes?: string[];
}

/** A content catalog declared in the manifest. */
export interface ManifestCatalog {
  type: ContentType;
  id: string;
  name: string;
}

/** The Stremio addon manifest. */
export interface Manifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: ManifestResource[];
  types: ContentType[];
  idPrefixes?: string[];
  catalogs: ManifestCatalog[];
}
