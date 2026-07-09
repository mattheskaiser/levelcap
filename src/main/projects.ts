import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { Project, ProjectSettings, ProjectSummary } from '@shared/types'

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
    clipCount: project.timelineClips.length,
    totalDurationSec: project.timelineClips.reduce(
      (acc, c) => acc + (c.trimEndSec - c.trimStartSec),
      0
    )
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
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    mediaBinClips: [],
    timelineClips: [],
    captions: [],
    settings: { ...emptySettings }
  }
  await persist(project)
  return project
}

export async function loadProject(id: string): Promise<Project> {
  const raw = await readFile(projectFilePath(id), 'utf-8')
  return JSON.parse(raw) as Project
}

export async function saveProject(project: Project): Promise<ProjectSummary> {
  const updated: Project = { ...project, updatedAt: new Date().toISOString() }
  await persist(updated)
  return summarize(updated)
}
