# Rushcut — Plan

Local desktop video editor for personal use: import phone clips, reorder on a
timeline, normalize audio, optional fades, background music, offline
auto-generated subtitles, export to mp4.

## Feature list

### MVP
- Import video clips (file picker, drag files onto the app)
- Drag-and-drop reordering of clips on a timeline
- One-click audio normalization across all clips (ffmpeg `loudnorm`)
- Auto-generated subtitles via local whisper.cpp, with a UI to edit caption
  text and adjust start/end timing
- Export final video (mp4) with normalization + subtitles baked in

### Later / nice-to-have
- Fade-to-black transitions between clips (toggle on/off)
- Background music: bundled royalty-free track library
- Background music: upload own MP3
- Trim in/out points per clip (beyond reordering)
- Export presets (resolution/quality)

## Implementation order

Each step is meant to be a single focused work session.

1. **IPC scaffolding** — define the `shared/types.ts` domain model (done:
   `Clip`, `CaptionSegment`, `MusicTrack`, `ProjectSettings`, `Project`,
   `ExportProgressEvent`) and stub IPC channels in preload with typed
   `invoke`/`on` wrappers, exposed as `window.api`.
2. **Import clips** — main-process handler that accepts file paths, probes
   duration via `ffprobe` (bundled alongside `ffmpeg-static` or via
   `ffprobe-static`), returns `Clip[]` to the renderer.
3. **Timeline UI** — render clips in order, drag-and-drop reordering
   (`@dnd-kit/core` or similar), updates `Project.clips[].order`.
4. **Audio normalization** — main-process ffmpeg pipeline using the
   `loudnorm` filter (two-pass: analyze then apply) per clip, writes
   normalized copies to a temp working directory. Wire a "Normalize audio"
   button with progress feedback over IPC.
5. **Subtitle generation** — main-process handler that extracts audio per
   clip (or per full concatenated timeline), runs `nodejs-whisper`, maps its
   segment/word timestamps into `CaptionSegment[]` keyed by clip + offset.
6. **Caption editor UI** — list/timeline view of `CaptionSegment[]`, inline
   text editing, drag handles to adjust `startSec`/`endSec`.
7. **Export (MVP)** — ffmpeg pipeline: concat normalized clips in timeline
   order, burn in captions (subtitles filter) or embed as a soft subtitle
   track, write final mp4. Progress reported via `ExportProgressEvent`.
8. **Fade transitions** (later) — insert `fade=out`/`fade=in` filter pairs at
   clip boundaries when `ProjectSettings.fadeTransitionsEnabled`.
9. **Background music** (later) — bundle a small royalty-free track library
   under `resources/music/`, mix in via ffmpeg `amix`/`sidechaincompress`
   at a configurable volume; support user-uploaded MP3 as an alternate
   `MusicTrack`.

## Architecture

**Process split**
- `src/main` — Electron main process. Owns all filesystem access, spawns
  `ffmpeg`/`ffprobe` (via `ffmpeg-static`) and `nodejs-whisper`, manages temp
  working directories, and is the only process allowed to touch project
  files on disk.
- `src/preload` — thin, typed bridge. Exposes an `window.api` object via
  `contextBridge` wrapping `ipcRenderer.invoke`/`.on` calls; no business
  logic lives here.
- `src/renderer` — React UI. Never touches the filesystem or shells out
  directly; everything goes through `window.api`.
- `src/shared` — types used by both main and renderer (`types.ts`), imported
  via the `@shared/*` path alias configured in both tsconfig projects and
  `electron.vite.config.ts`.

**IPC channels needed** (request/response via `ipcMain.handle` /
`ipcRenderer.invoke` unless noted)
- `clips:import` — file paths in → probed `Clip[]` out
- `clips:reorder` — updated ordering in → ack
- `audio:normalize` — clip IDs in → normalized file paths out (progress via
  `audio:normalize:progress` event, one-way `ipcRenderer.on`)
- `subtitles:generate` — clip IDs in → `CaptionSegment[]` out (progress via
  `subtitles:generate:progress` event)
- `captions:update` — edited `CaptionSegment[]` in → ack
- `project:export` — `Project` in → output path out (progress via
  `export:progress`, payload typed as `ExportProgressEvent`)
- `music:listBundled` — no args → `MusicTrack[]` of bundled tracks
- `music:import` — file path in → `MusicTrack` out

**Temp files**
- A per-project working directory under `app.getPath('temp')/rushcut/<projectId>/`.
- Subfolders: `normalized/` (post-`loudnorm` clip copies), `audio/`
  (extracted mono wav per clip for whisper input — whisper.cpp wants 16kHz
  wav), `export/` (intermediate concat list file, final render before it's
  moved/copied to the user's chosen output path).
- Cleaned up on project close, but left in place if the app crashes so a
  future "recover project" pass is possible later.

**Whisper output → caption data structure**
- `nodejs-whisper` returns per-segment (and optionally per-word) timestamps
  plus text. Each segment is mapped 1:1 to a `CaptionSegment`, with
  `startSec`/`endSec` taken directly from whisper's segment timestamps and
  `clipId` set from whichever clip's audio was fed in.
- If subtitles are generated per-clip (not on the full concatenated
  timeline), timestamps are already clip-relative — no offset math needed
  when captions are edited per-clip. If generated on the full concatenated
  render instead, each clip's cumulative start offset must be subtracted
  back out when splitting segments by clip. Which of these two approaches
  to use is an open question below.
- Editing in the UI mutates `CaptionSegment.text`/`startSec`/`endSec`
  directly; there's no separate "raw whisper output" retained after the
  first edit.

## Open questions

- **Which whisper.cpp model to bundle (tiny / base / small)?** Clips are
  short and un-narrated home footage, not dense dialogue — `base.en` is
  probably the right default (much faster than `small`, meaningfully more
  accurate than `tiny` for casual speech), but this needs a real accuracy
  check against a few actual clips before locking in. Should the model be
  bundled in the installer (`resources/`) or downloaded on first run via
  `npx nodejs-whisper download`?
- **Per-clip vs. whole-timeline transcription.** Per-clip is simpler
  (timestamps are already clip-relative, re-generating for one edited clip
  is cheap) but loses cross-clip context for the model. Whole-timeline is
  likely more accurate but requires offset bookkeeping and re-running
  transcription on the full timeline after any reorder.
- **whisper.cpp build step on Windows.** `nodejs-whisper` compiles
  whisper.cpp from source on first real use and needs `make`
  (MinGW-w64/MSYS2) on Windows — **this dev machine does not currently have
  `make`/`gcc`/`cmake` installed.** The smoke test only confirms the module
  imports and its function is callable; it does not compile or run a real
  transcription. Installing MSYS2 (or switching to a whisper.cpp binding
  that ships prebuilt binaries) is a prerequisite before step 5 can be
  built for real.
- **Concat strategy for export.** ffmpeg concat demuxer (fast, requires
  matching codecs/parameters across normalized clips) vs. re-encoding
  through the concat filter (slower, tolerates mismatched source formats
  from different phone recordings/orientations). Phone clips may vary in
  resolution/rotation metadata, so this likely needs the filter-based
  approach, at some export-speed cost.
- **Caption rendering in export**: burned-in (`subtitles`/`ass` filter,
  simplest, always visible) vs. soft subtitle track (`mov_text` stream,
  toggleable in players that support it, but not all mp4 players show
  soft subtitles by default). Given "just for my own workflow," burned-in
  is probably fine unless there's a reason to keep them removable later.
- **Background music mixing levels** — fixed default ducking under
  dialogue vs. a simple user-facing volume slider only (no auto-ducking).
  Simpler to ship the slider first.

## Status

Scaffold complete: Electron + React + TS via `electron-vite`, ESLint +
Prettier wired up, strict TypeScript (`strict` + `noUncheckedIndexedAccess`)
across both the node and web tsconfig projects, `main`/`preload`/`renderer`/
`shared` folder split with a `@shared/*` alias, `ffmpeg-static` and
`nodejs-whisper` installed and smoke-tested from the main process (see
`src/main/smokeTest.ts`), git initialized, `dev`/`build`/`typecheck`/`lint`
all verified working.

No feature code has been written yet — stopping here per plan for review
before starting step 1.
