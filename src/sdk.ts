import { addonBuilder as buildAddon } from 'stremio-addon-sdk';

import type { ContentType, Manifest, MetaDetail, MetaPreview } from './types';

/**
 * Typed wrapper around the official `stremio-addon-sdk` (which ships no
 * TypeScript declarations). This is the only file allowed to touch the
 * untyped SDK boundary.
 */

export interface CatalogHandlerArgs {
  type: ContentType;
  id: string;
}

export interface MetaHandlerArgs {
  type: ContentType;
  id: string;
}

export interface AddonBuilder {
  defineCatalogHandler(handler: (args: CatalogHandlerArgs) => Promise<{ metas: MetaPreview[] }>): void;
  defineMetaHandler(handler: (args: MetaHandlerArgs) => Promise<{ meta: MetaDetail }>): void;
  getInterface(): AddonInterface;
}

export interface AddonInterface {
  manifest: Manifest;
  get(resource: 'catalog' | 'meta', type: ContentType, id: string): Promise<unknown>;
}

export function createAddonBuilder(manifest: Manifest): AddonBuilder {
  return buildAddon(manifest) as AddonBuilder;
}
