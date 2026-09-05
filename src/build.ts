import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fetchMetaDetail, toMetaPreview } from './cinemeta';
import { createAddonBuilder } from './sdk';
import { CONTENT_TYPES, TYPE_BY_SECTION } from './types';
import type { ContentType, Manifest, MetaDetail, Whitelist } from './types';

/** Bump this when the whitelist changes so clients refresh their cached manifest. */
const ADDON_VERSION = '1.0.0';

const ADDON_ID = 'com.example.kids-catalog';
const ADDON_NAME = 'Kids Catalog';
const CATALOG_ID = 'kids';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && /^tt\d+$/.test(value);
}

function parseIdList(value: unknown, section: string): string[] {
  if (!Array.isArray(value) || !value.every(isImdbId)) {
    throw new Error(`"${section}" in approved-content.json must be an array of IMDb ids like "tt0114709"`);
  }
  return value as string[];
}

/** Reads and validates the whitelist, the single source of truth. */
export async function readWhitelist(): Promise<Whitelist> {
  const filePath = path.resolve(process.cwd(), 'approved-content.json');
  const text = await readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('approved-content.json must be a JSON object');
  }
  const record = parsed as Record<string, unknown>;
  const whitelist: Whitelist = {
    movies: parseIdList(record.movies, 'movies'),
    series: parseIdList(record.series, 'series'),
  };
  return whitelist;
}

/** The Stremio addon manifest; declares catalog + meta resources only. */
export function buildManifest(): Manifest {
  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: ADDON_NAME,
    description: 'Only the titles listed in approved-content.json. Streams are provided by other addons.',
    resources: [
      { name: 'catalog', types: [...CONTENT_TYPES], idPrefixes: ['tt'] },
      { name: 'meta', types: [...CONTENT_TYPES], idPrefixes: ['tt'] },
    ],
    types: [...CONTENT_TYPES],
    idPrefixes: ['tt'],
    catalogs: [
      { type: 'movie', id: CATALOG_ID, name: 'Kids Movies' },
      { type: 'series', id: CATALOG_ID, name: 'Kids Shows' },
    ],
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Fetches all meta objects, grouped by content type. */
async function fetchAllMetas(whitelist: Whitelist): Promise<Readonly<Record<ContentType, MetaDetail[]>>> {
  const result: Record<ContentType, MetaDetail[]> = { movie: [], series: [] };
  for (const section of Object.keys(TYPE_BY_SECTION) as (keyof Whitelist)[]) {
    const type = TYPE_BY_SECTION[section];
    console.log(`Fetching ${whitelist[section].length} ${type} meta object(s) from Cinemeta...`);
    for (const imdbId of whitelist[section]) {
      const meta = await fetchMetaDetail(type, imdbId);
      result[type].push(meta);
      console.log(`  ok ${type}/${imdbId}`);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const whitelist = await readWhitelist();
  const metasByType = await fetchAllMetas(whitelist);

  // The SDK validates the manifest and dispatches requests to the handlers,
  // exactly as it would for a dynamic addon. We then render the responses
  // to static files so no server is needed at runtime.
  const builder = createAddonBuilder(buildManifest());
  builder.defineCatalogHandler(async (args) => ({
    metas: metasByType[args.type].map(toMetaPreview),
  }));
  builder.defineMetaHandler(async (args) => {
    const meta = metasByType[args.type].find((item) => item.id === args.id);
    if (!meta) {
      throw new Error(`No approved meta for ${args.type}/${args.id}`);
    }
    return { meta };
  });
  const addon = builder.getInterface();

  await writeJson(path.join(DIST_DIR, 'manifest.json'), addon.manifest);
  for (const type of CONTENT_TYPES) {
    const catalogResponse = await addon.get('catalog', type, CATALOG_ID);
    await writeJson(path.join(DIST_DIR, 'catalog', type, `${CATALOG_ID}.json`), catalogResponse);
    for (const meta of metasByType[type]) {
      const metaResponse = await addon.get('meta', type, meta.id);
      await writeJson(path.join(DIST_DIR, 'meta', type, `${meta.id}.json`), metaResponse);
    }
  }
  console.log(`Done. Static addon written to ${DIST_DIR}`);
}

void main();
