import type { MockCaption, MockClip, MockTrack } from './types'

export const initialMediaBin: MockClip[] = [
  { id: 'b1', name: 'IMG_4835.MOV', durationSec: 11.4, seed: 55 },
  { id: 'b2', name: 'IMG_4840.MOV', durationSec: 19.0, seed: 71 }
]

export const initialTimelineClips: MockClip[] = [
  { id: 'c1', name: 'IMG_4821.MOV', durationSec: 14.2, seed: 3 },
  { id: 'c2', name: 'IMG_4824.MOV', durationSec: 8.6, seed: 17 },
  { id: 'c3', name: 'IMG_4830.MOV', durationSec: 21.9, seed: 41 },
  { id: 'c4', name: 'IMG_4833.MOV', durationSec: 6.3, seed: 9 }
]

export const initialTracks: MockTrack[] = [
  { id: 'm1', name: 'Little Wins', durationSec: 118 },
  { id: 'm2', name: 'Morning Drive', durationSec: 142 },
  { id: 'm3', name: 'Slow Bloom', durationSec: 96 }
]

export const initialCaptions: MockCaption[] = [
  { id: 'p1', startSec: 0.2, endSec: 2.4, text: 'so we pulled up to the trailhead around nine' },
  { id: 'p2', startSec: 2.6, endSec: 5.1, text: 'everyone was already lacing up' },
  {
    id: 'p3',
    startSec: 15.0,
    endSec: 18.0,
    text: 'this part of the trail levels out for a while'
  },
  {
    id: 'p4',
    startSec: 23.5,
    endSec: 27.0,
    text: 'and this is where it starts climbing again'
  },
  { id: 'p5', startSec: 45.2, endSec: 48.0, text: "made it, that's the whole loop" }
]
