import { DEFAULT_STATE } from '@o-control/shared';
import type { OControlState } from '@o-control/shared';

export function receiverState(overrides: Partial<OControlState> = {}): OControlState {
  return {
    ...DEFAULT_STATE,
    connected: true,
    power: 'on',
    input: 'net',
    volume: 22,
    playback: 'playing',
    ...overrides,
    nowPlaying: {
      ...DEFAULT_STATE.nowPlaying,
      title: 'Blue in Green',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      currentTime: '01:42',
      totalTime: '05:27',
      format: 'FLAC',
      sampleRate: '96 kHz',
      bitDepth: '24 bit',
      coverArtUrl: '/cover-art',
      ...overrides.nowPlaying,
    },
    netList: {
      ...DEFAULT_STATE.netList,
      ...overrides.netList,
    },
  };
}
