# Kids Catalog Addon

A tiny, static **Stremio-protocol catalog addon** that exposes only the titles you
explicitly approve in [`approved-content.json`](approved-content.json). Playback is
provided entirely by your existing **TorBox Stremio addon** — this project has no
streaming code, no torrent resolution, no TorBox API key, no database, no media
hosting, and no ads.

> **Read this first:** the addon curates the *UI*. Whether a child can actually be
> kept inside the curated list depends on the **client app**, not on any addon.
> Stock Stremio cannot be locked down (see below). The recommended client for a
> truly kid-safe experience is [Nuvio](https://nuvio.tv) — a free, open-source
> Stremio-protocol client with PIN-protected standalone profiles. The same addon
> and the same TorBox addon work in both.

---

## 1. Does the architecture work? (Yes)

The Stremio addon protocol has **no link between a catalog row and stream
resolution**. The client associates content by its global content ID (`tt` + IMDb
id), and requests are broadcast to all installed addons whose manifest matches:

| Resource | Who answers | What the client does |
|---|---|---|
| `catalog/{type}/{id}.json` | Every installed addon that declares that catalog | Rows are rendered on the Home/Discover screens, labeled by addon |
| `meta/{type}/{id}.json` | **All** installed addons declaring `meta` + matching `types`/`idPrefixes` | Responses are merged into one detail page |
| `stream/{type}/{videoId}.json` | **All** installed addons declaring `stream` + matching `types`/`idPrefixes` | Streams are merged into the source-selection list |

Therefore:

1. Our addon declares only `catalog` + `meta` with `idPrefixes: ["tt"]` → it is
   never asked for streams and never sees playback.
2. When a title from our catalog is opened, the client asks **every installed
   stream addon** for `stream/movie/tt0114709.json`. TorBox's addon declares
   `stream` for `tt` ids, so it resolves the stream **regardless of which catalog
   the title came from**.
3. Metadata works the same way: even if our addon shipped no meta at all, Cinemeta
   (always installed in Stremio) would supply it for any `tt` id. We ship our own
   meta so the addon is self-contained and the kid profile in Nuvio can run
   without Cinemeta.

Sources: official addon protocol docs
([`stremio-addon-sdk` repo](https://github.com/Stremio/stremio-addon-sdk),
`docs/protocol.md` and `docs/api/responses/manifest.md`).

## 2. Security reality check: stock Stremio vs Nuvio

The security requirement splits into three different controls:

1. **What appears in the UI** (catalogs, search results)
2. **What can technically be played** (stream resolution)
3. **Who can modify configuration** (installed addons, settings)

### Stock Stremio cannot satisfy the requirement

- **Cinemeta is permanently installed and cannot be uninstalled.** Stremio's own
  blog states this explicitly ("there is a reason why you cannot uninstall it from
  the apps"). Cinemeta provides full **Search** and catalogs over the entire IMDb
  database → requirement "child cannot browse/search" fails.
- **No parental controls / PIN / profiles.** Any user can open the Addons menu,
  install community addons, or reorder addons. There is an open feature request
  for this (stremio-features#574). → "child cannot modify configuration" fails.
- **TorBox resolves any `tt` id.** Playback restriction is therefore impossible at
  the addon level; the only lever is *removing discovery*, which stock Stremio
  does not allow.
- **Addons sync per Stremio account**, not per device or per person.

**Conclusion:** in stock Stremio this addon delivers a nicer curated row — it is
*not* a child lock. The same is true of Stremio's web player.

### Nuvio actually satisfies the requirement (free)

[Nuvio](https://nuvio.tv) is a free, open-source (GPLv3) client that speaks the
standard Stremio addon protocol, with official Android TV, Android/iOS, Linux,
Windows, macOS and web builds (the TV app is currently in beta). Its profiles
feature (documented in the Nuvio wiki, `Settings → Profiles`) provides:

- Up to **6 profiles** per free Nuvio account.
- **Standalone profiles**: a profile can opt out of addon inheritance and run its
  own, completely separate addons and catalogs.
- **PIN protection**: each profile can be locked with a PIN, required every time
  the profile is opened, preventing access to other profiles' content and
  settings.
- Per-profile addon management (the kid profile cannot edit addons).

**Kid profile recipe (the actual security fix):**

1. Create a free Nuvio account; set up your primary profile with your normal
   addons.
2. Create a second profile, e.g. "Kids":
   - **Standalone** — do **not** inherit the primary profile's addons.
   - Set a **PIN** and require it on every entry.
3. Inside the Kids profile, install **only**:
   - this catalog addon, and
   - the official TorBox Stremio addon.
4. Disable or remove **Cinemeta** inside the Kids profile (Nuvio allows it; the
   wiki recommends disabling it when you use other metadata addons).
5. Verify on the device:
   - Home shows only "Kids Movies" / "Kids Shows".
   - Search finds nothing (no search-capable catalog addon is installed).
   - The Addons menu is not reachable without the PIN.
   - Opening an approved title shows TorBox streams and plays.

The same steps apply to the Android TV and Linux (HTPC) installs of Nuvio, which
share the account and profiles.

### Root of trust

The Nuvio account credentials are the root of trust: anyone holding them can
change the PIN or addons from the web dashboard. Keep them to yourself — the same
caveat applies to any parental-control system that is not a separate managed
device.

## 3. Repository structure

```
.
├── approved-content.json          # THE whitelist — the only file you edit
├── package.json
├── tsconfig.json
├── docs/code-style-rules.md       # coding conventions used in this repo
├── .github/workflows/deploy-pages.yml
└── src
    ├── build.ts                   # reads whitelist, renders static endpoints
    ├── cinemeta.ts                # fetches/validates Cinemeta metadata
    ├── sdk.ts                     # typed wrapper over stremio-addon-sdk
    ├── stremio-addon-sdk.d.ts     # 1-line ambient decl (SDK ships no types)
    └── types.ts                   # minimal protocol types
```

## 4. `approved-content.json` format

```json
{
  "movies": ["tt0114709", "tt0266543", "tt2096673"],
  "series": ["tt0417299"]
}
```

IMDb ids (`tt…`) are used as content ids. The build script validates the format
and fails loudly on bad input.

## 5. How metadata is handled

At build time, the script fetches each title's meta from Cinemeta's public,
key-less endpoint (`https://v3-cinemeta.strem.io/meta/{type}/{id}.json`) — the
same metadata Stremio shows anyway — and renders it to static files:

- `dist/catalog/{movie|series}/kids.json` — catalog rows (`metas`), containing
  preview fields only (no episode lists) to keep responses small.
- `dist/meta/{type}/{id}.json` — full meta (`meta`), including episode videos for
  series.
- `dist/manifest.json` — the manifest below.

No API keys, no TMDB account, no runtime fetching.

### Required manifest (generated)

```json
{
  "id": "com.example.kids-catalog",
  "version": "1.0.0",
  "name": "Kids Catalog",
  "resources": [
    { "name": "catalog", "types": ["movie", "series"], "idPrefixes": ["tt"] },
    { "name": "meta", "types": ["movie", "series"], "idPrefixes": ["tt"] }
  ],
  "types": ["movie", "series"],
  "idPrefixes": ["tt"],
  "catalogs": [
    { "type": "movie", "id": "kids", "name": "Kids Movies" },
    { "type": "series", "id": "kids", "name": "Kids Shows" }
  ]
}
```

Deliberately absent: `stream`, `subtitles`, search extras, TorBox credentials.

## 6. Why the official SDK is (and isn't) here

The addon uses the official **`stremio-addon-sdk`**: the build constructs the
manifest with `addonBuilder`, registers `catalog`/`meta` handlers, and renders
each response through the SDK's own `getInterface().get(...)` dispatch. The SDK
thus validates the manifest and responses exactly as it would for a live server —
we just serialize the results to static files instead of serving them. The npm
package ships no TypeScript declarations, so `src/sdk.ts` provides a typed
boundary (no `any` in the codebase).

## 7. Deployment: GitHub alone is enough

A catalog + meta addon needs only static JSON files, so **GitHub Pages alone can
serve the addon** — no server, no database, no Workers, no VPS.

1. Push this repo to GitHub (branch `main`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The included workflow builds `dist/` and deploys it. Your addon URL is
   `https://<user>.github.io/<repo>/manifest.json`.

**Notes**

- The manifest version is bumped automatically on every deploy
  (`ADDON_VERSION=1.0.<run_number>`), so clients detect whitelist changes.
- GitHub Pages cannot set custom response headers. Native clients (Stremio
  desktop/Android TV, Nuvio) do not enforce CORS, so this is fine for the two
  target devices. If you also want the addon to work in a browser (Stremio Web),
  host the same `dist/` on **Cloudflare Pages** (free) with a `_headers` file
  containing `/*` → `Access-Control-Allow-Origin: *`.

## 8. Install

- **Stremio** (curated UI only — not a lock): install from
  `stremio://<user>.github.io/<repo>/manifest.json`, or paste the `https://`
  manifest URL in Addons → search bar. Addons sync to the Stremio account.
- **Nuvio**: Settings → Addons → paste
  `https://<user>.github.io/<repo>/manifest.json` **inside the Kids profile**.

## 9. TorBox addon setup

Generate your personal TorBox Stremio addon URL from the TorBox dashboard/help
center (it embeds your TorBox API token). Install it in the same profile as this
addon — it supplies streams for every `tt` id, which is exactly what we rely on.

Two security notes:

- The TorBox addon URL **contains your API key**. Inside a PIN-locked profile the
  child cannot read or change it; on stock Stremio anyone can.
- Open the TorBox addon's `manifest.json` in a browser once and check its
  `catalogs` array. If it declares catalogs (e.g. your TorBox library), those
  rows will also appear in the kid profile. They only show content already in
  your TorBox library — not arbitrary content — but if that matters to you,
  consider a separate TorBox account for kids.

## 10. Maintenance

1. Edit `approved-content.json` in the GitHub web UI (add/remove `tt` ids) —
   that is the only manual step.
2. GitHub Actions rebuilds and redeploys within ~1 minute, with a new manifest
   version, so clients notice the change.
3. Refresh the client:
   - **Nuvio:** Settings → Addons → *Refresh* on the addon (one tap).
   - **Stremio:** restart the app, or reinstall the addon.

Local builds still work: `npm run build` uses a fallback version.

## 11. Limitations a catalog addon cannot solve

1. **No enforcement in stock Stremio.** The addon cannot remove Cinemeta, disable
   search, hide other addons' catalogs, or lock addon management — those are
   client features that only Nuvio currently provides.
2. **No playback restriction.** Stream resolution is by content id across all
   stream addons; nothing in an addon can stop TorBox from resolving a title the
   client asks for. Security comes from removing discovery paths and locking the
   client, not from the addon.
3. **TorBox's own catalogs** (if any) appear regardless of our addon.
4. **Static metadata staleness.** Posting changes requires a rebuild (automatic
   via Actions).
5. **Root of trust** is the Nuvio/Stremio account password.
6. **Nuvio TV is beta** software; test it on your device before handing it to a
   child.
