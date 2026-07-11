# Levelcap — Plan

Local desktop tool for a single workflow: take one already-edited ~20-minute
video (cut together in CapCut from many clips, some quiet, some loud, some
silent), and produce (1) a loudness-normalized copy of it and (2) a subtitle
file, ready to import back into CapCut for final polish. No timeline, no
multi-clip composition, no project list — the input is already one edited
file.

## Pipeline

1. **Upload** — pick a video file (dialog or drag-and-drop), probed via
   `ffprobe`.
2. **Transcribe + normalize (automatic, run concurrently)**
   - Extract a mono 16kHz wav (`ffmpeg`) for whisper input.
   - Transcribe via a prebuilt whisper.cpp CLI (`whisper-cli.exe`, shelled
     out to like `ffmpeg-static`) with `-ml 42 -sow` so segments are already
     short, natural phrases rather than one-word or one-paragraph chunks.
   - Normalize the whole file's audio with `dynaudnorm` (adapts gain over a
     sliding window, which is what actually evens out clips recorded at
     different levels within one file) chained into a single `loudnorm`
     pass (brings the now-consistent result to a standard overall target).
     `-c:v copy` throughout — video/text-overlay stream is never re-encoded.
3. **Review/edit** — video preview with a movie-subtitle-style overlay
   (bottom-anchored, white text, black stroke, no box — preview only, SRT
   itself carries no styling), and an editable transcript list (text, start/
   end nudge, delete).
4. **Export** — writes `<name>.mp4` (the normalized file) and `<name>.srt`
   next to each other. SRT was chosen after checking CapCut's own docs: it's
   the format CapCut leads with for "import captions as separate, editable,
   correctly-timed text blocks" (`.ass` is accepted but explicitly the
   secondary/less-reliable path).

## Architecture

**Process split** (unchanged from the original scaffold)

- `src/main` — owns ffmpeg/whisper-cli subprocesses and all filesystem
  access.
- `src/preload` — thin typed bridge (`window.api`), no business logic.
- `src/renderer` — React UI, everything goes through `window.api`.
- `src/shared` — `types.ts` (`SourceVideo`, `Segment`, `PipelineProgressEvent`,
  `ExportResult`) + `ipc.ts` (the `LevelcapApi` contract), imported via
  `@shared/*`.

**Main-process modules**

- `video.ts` — probes a single file via `ffprobe`.
- `whisper.ts` — resolves `resources/whisper/{bin,models}`, shells out to
  `whisper-cli.exe`, parses its `-oj` JSON output into `Segment[]`.
- `normalize.ts` — one ffmpeg pass, `dynaudnorm,loudnorm` filter chain.
- `srt.ts` — formats `Segment[]` into a valid `.srt` file.
- `pipeline.ts` — orchestrates extract → (transcribe ‖ normalize) →
  `PipelineProgressEvent`s over IPC.
- `ipc.ts` — `video:select`, `video:importPath`, `pipeline:run` (progress
  events), `export:run` (save dialog → writes the `.mp4` + `.srt` pair).

**No persistence.** Closing the app mid-session loses the current video's
state — this was a deliberate simplification, not an oversight.

## Whisper setup

`npm run setup:whisper` (`scripts/setup-whisper.mjs`) downloads the official
prebuilt whisper.cpp Windows CLI release (`whisper-bin-x64.zip`) and the
`ggml-base.en.bin` model into `resources/whisper/` (gitignored) — no local
compiler needed, and transcription is fully offline once this has run once.
Re-run any time to re-fetch a missing file.

## Status

Rewritten from the earlier multi-track-editor scaffold down to this single
pipeline. Verified end-to-end against a real synthesized test video (quiet
speech clip + silent gap + loud speech clip, plus a text overlay near the
top): upload → transcribe/normalize → edit a segment → export → both output
files valid, overlay preserved, level gap between the quiet/loud sections
narrowed from ~23dB to ~2-7dB.
