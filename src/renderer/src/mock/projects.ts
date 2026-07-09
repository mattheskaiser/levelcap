export interface MockProject {
  id: string
  name: string
  clipCount: number
  durationLabel: string
  updatedLabel: string
  seed: number
  isDemo?: boolean
}

export const initialProjects: MockProject[] = [
  {
    id: 'proj-trip-edit',
    name: 'Trip Edit',
    clipCount: 4,
    durationLabel: '0:51',
    updatedLabel: '2 hours ago',
    seed: 12,
    isDemo: true
  },
  {
    id: 'proj-family-bbq',
    name: 'Family BBQ',
    clipCount: 7,
    durationLabel: '3:14',
    updatedLabel: 'Yesterday',
    seed: 34
  },
  {
    id: 'proj-weekend-hike',
    name: 'Weekend Hike',
    clipCount: 12,
    durationLabel: '5:02',
    updatedLabel: '4 days ago',
    seed: 58
  }
]
