import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { Project, ProjectSettings, ProjectSummary, Track } from '@shared/types'
import { CURRENT_SCHEMA_VERSION } from '@shared/types'
import { timelineDurationSec, videoItemsAcrossTracks } from '@shared/tracks'

function projectsDir(): string {
  return join(app.getPath('userData'), 'projects')
}

function registryPath(): string {
  return join(app.getPath('userData'), 'projects.json')
}

function projectFilePath(id: string): string {
  return join(projectsDir(), `${id}.json`)
}

async function ensureProjectsDir(): Promise<void> {
  await mkdir(projectsDir(), { recursive: true })
}

async function readRegistry(): Promise<ProjectSummary[]> {
  if (!existsSync(registryPath())) return []
  const raw = await readFile(registryPath(), 'utf-8')
  return JSON.parse(raw) as ProjectSummary[]
}

async function writeRegistry(entries: ProjectSummary[]): Promise<void> {
  await ensureProjectsDir()
  await writeFile(registryPath(), JSON.stringify(entries, null, 2), 'utf-8')
}

function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    clipCount: videoItemsAcrossTracks(project.tracks).length,
    totalDurationSec: timelineDurationSec(project.tracks)
  }
}

async function persist(project: Project): Promise<void> {
  await ensureProjectsDir()
  await writeFile(projectFilePath(project.id), JSON.stringify(project, null, 2), 'utf-8')

  const registry = await readRegistry()
  const summary = summarize(project)
  const index = registry.findIndex((entry) => entry.id === project.id)
  if (index >= 0) registry[index] = summary
  else registry.push(summary)
  await writeRegistry(registry)
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const entries = await readRegistry()
  return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

const emptySettings: ProjectSettings = { fadeJunctions: [], normalizedClipIds: [] }

export async function createProject(name: string): Promise<Project> {
  const now = new Date().toISOString()
  const project: Project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    mediaBinClips: [],
    tracks: [],
    settings: { ...emptySettings }
  }
  await persist(project)
  return project
}

// --- Schema migration ---
// Version 1 (no schemaVersion field on disk) predates tracks: one implicit sequential
// video-clip array plus one flat caption list. Version 2 introduces generic tracks.

interface LegacyClip {
  id: string
  sourcePath: string
  order: number
  durationSec: number
  trimStartSec: number
  trimEndSec: number
}

interface LegacyCaptionSegment {
  id: string
  startSec: number
  endSec: number
  text: string
}

interface LegacyProjectV1 {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  mediaBinClips: LegacyClip[]
  timelineClips: LegacyClip[]
  captions: LegacyCaptionSegment[]
  settings: ProjectSettings
}

function migrateFromV1(legacy: LegacyProjectV1): Project {
  let cursorSec = 0
  const videoItems = [...legacy.timelineClips]
    .sort((a, b) => a.order - b.order)
    .map((clip) => {
      const startSec = cursorSec
      cursorSec += clip.trimEndSec - clip.trimStartSec
      return {
        kind: 'video' as const,
        id: clip.id,
        sourcePath: clip.sourcePath,
        durationSec: clip.durationSec,
        trimStartSec: clip.trimStartSec,
        trimEndSec: clip.trimEndSec,
        startSec
      }
    })

  const textItems = legacy.captions.map((cap) => ({
    kind: 'text' as const,
    id: cap.id,
    startSec: cap.startSec,
    endSec: cap.endSec,
    text: cap.text
  }))

  const tracks: Track[] = [
    { id: randomUUID(), name: 'Track 1', items: videoItems },
    { id: randomUUID(), name: 'Track 2', items: textItems }
  ]

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: legacy.id,
    name: legacy.name,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    mediaBinClips: legacy.mediaBinClips.map((clip) => ({
      id: clip.id,
      sourcePath: clip.sourcePath,
      durationSec: clip.durationSec,
      trimStartSec: clip.trimStartSec,
      trimEndSec: clip.trimEndSec
    })),
    tracks,
    settings: legacy.settings
  }
}

function migrateProject(raw: unknown): Project {
  const version = (raw as { schemaVersion?: number }).schemaVersion ?? 1

  if (version === CURRENT_SCHEMA_VERSION) {
    return raw as Project
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error('Project was saved by a newer version of Rushcut')
  }
  return migrateFromV1(raw as LegacyProjectV1)
}

export async function loadProject(id: string): Promise<Project> {
  const raw = await readFile(projectFilePath(id), 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  const originalVersion = (parsed as { schemaVersion?: number }).schemaVersion ?? 1
  const project = migrateProject(parsed)
  if (originalVersion !== CURRENT_SCHEMA_VERSION) {
    await persist(project)
  }
  return project
}

export async function saveProject(project: Project): Promise<ProjectSummary> {
  const updated: Project = { ...project, updatedAt: new Date().toISOString() }
  await persist(updated)
  return summarize(updated)
}
