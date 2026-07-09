# Project Setup Prompt

Paste this into your coding assistant to bootstrap the project.

---

I'm building a local desktop video editor for personal use (not commercial, not going to be marketed, just for my own workflow and portfolio). Set up the initial project and a planning document. Here's the spec:

**What it does:**
1. Import short video clips (recorded on phone throughout the day)
2. Drag-and-drop reordering of clips on a timeline
3. One-click automated audio normalization across all clips (consistent loudness, no manual per-clip adjustment) — use ffmpeg's `loudnorm` filter
4. Optional fade-to-black transitions between clips (toggle on/off)
5. Background music: pick from a bundled royalty-free track library, or upload own MP3
6. Auto-generated subtitles using local Whisper (whisper.cpp, NOT the paid OpenAI API — this must run fully offline on the user's machine) with a UI to edit caption text and adjust timing after generation
7. Export final video (mp4) with everything baked in

**Tech stack:**
- Electron + React + TypeScript
- Vite for dev/build (use `electron-vite` scaffold, not raw Electron Forge)
- ffmpeg for all audio/video processing (shell out via Node child_process, or `fluent-ffmpeg` if it simplifies things — bundle ffmpeg binary via `ffmpeg-static` so users don't need it installed separately)
- whisper.cpp for transcription (either shell out to a compiled whisper.cpp binary, or use a maintained Node binding like `nodejs-whisper` or `whisper-node` — pick whichever has better active maintenance, check npm before deciding)
- Local state only, no backend server, no cloud services, no user accounts

**Setup tasks — please do all of these:**
1. Scaffold the Electron + React + TS project with `electron-vite`
2. Configure ESLint (typescript-eslint, react hooks plugin, react-refresh plugin) and Prettier, with a working `lint` and `format` npm script
3. Enable TypeScript strict mode in tsconfig (`strict: true`, `noUncheckedIndexedAccess: true`)
4. Set up a working dev script (`npm run dev`) that launches Electron with hot reload, and a `build` script that produces a packaged app
5. Set up folder structure: separate `main` (Electron main process — file system, ffmpeg calls, whisper calls) from `renderer` (React UI) from `shared` (types used by both)
6. Add a `.gitignore` appropriate for Electron/Node/ffmpeg binaries, and initialize git
7. Install and do a smoke test on ffmpeg-static and the whisper.cpp integration path (just confirm both are callable from the main process, doesn't need to do real work yet)
8. Add a basic CI-friendly `typecheck` script (`tsc --noEmit`) that can be run standalone

**Documentation task:**
Create a `PLAN.md` at the project root containing:
- A feature list broken into MVP vs later/nice-to-have (transitions and background music can be later, normalization + reordering + subtitles are MVP)
- A step-by-step implementation plan, in the order features should be built, with each step small enough to be a single focused work session
- The architecture: how main/renderer communicate (IPC channels needed), where temp files live during processing, how the whisper output (timestamps + text) maps to an editable caption data structure
- Open technical questions or decisions that still need to be made (e.g. which whisper.cpp model size to bundle — tiny/base/small — as a tradeoff between speed and accuracy for short un-narrated clips)

Once the scaffold and PLAN.md are done, stop and show me the plan before writing any feature code, so I can review the order before we start building.
