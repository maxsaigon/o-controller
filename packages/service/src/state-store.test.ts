import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { StateStore } from './state-store.js';
import type { ParsedPacket } from '@o-control/eiscp';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  describe('initial state', () => {
    it('should have default values', () => {
      const state = store.getState();
      assert.equal(state.connected, false);
      assert.equal(state.power, 'unknown');
      assert.equal(state.input, 'unknown');
      assert.equal(state.volume, 0);
      assert.equal(state.muted, false);
      assert.equal(state.playback, 'unknown');
      assert.equal(state.nowPlaying.title, '');
    });
  });

  describe('setConnected', () => {
    it('should update connected status and notify', () => {
      let notified = false;
      store.subscribe(() => { notified = true; });
      store.setConnected(true);
      assert.equal(store.getState().connected, true);
      assert.equal(notified, true);
    });

    it('should reset power to unknown on disconnect', () => {
      store.reduce({ command: 'PWR', rawPayload: '01' });
      store.setConnected(true);
      store.setConnected(false);
      assert.equal(store.getState().power, 'unknown');
    });

    it('should not notify if value unchanged', () => {
      let count = 0;
      store.subscribe(() => { count++; });
      store.setConnected(false); // already false
      assert.equal(count, 0);
    });
  });

  describe('reduce — power', () => {
    it('should set power on', () => {
      store.reduce({ command: 'PWR', rawPayload: '01' });
      assert.equal(store.getState().power, 'on');
    });

    it('should set power off', () => {
      store.reduce({ command: 'PWR', rawPayload: '00' });
      assert.equal(store.getState().power, 'off');
    });
  });

  describe('reduce — volume', () => {
    it('should set volume from hex', () => {
      store.reduce({ command: 'MVL', rawPayload: '1A' });
      assert.equal(store.getState().volume, 26);
    });

    it('should set volume to 0', () => {
      store.reduce({ command: 'MVL', rawPayload: '00' });
      assert.equal(store.getState().volume, 0);
    });

    it('should set volume to 100', () => {
      store.reduce({ command: 'MVL', rawPayload: '64' });
      assert.equal(store.getState().volume, 100);
    });

    it('should treat UP/DOWN payloads as known no-op updates', () => {
      store.reduce({ command: 'MVL', rawPayload: '1A' });
      const known = store.reduce({ command: 'MVL', rawPayload: 'UP' });
      assert.equal(known, true);
      assert.equal(store.getState().volume, 26);
    });
  });

  describe('reduce — mute', () => {
    it('should set muted on', () => {
      store.reduce({ command: 'AMT', rawPayload: '01' });
      assert.equal(store.getState().muted, true);
    });

    it('should set muted off', () => {
      store.reduce({ command: 'AMT', rawPayload: '00' });
      assert.equal(store.getState().muted, false);
    });
  });

  describe('reduce — input', () => {
    it('should set input to net', () => {
      store.reduce({ command: 'SLI', rawPayload: '2B' });
      assert.equal(store.getState().input, 'net');
    });

    it('should set input to cd', () => {
      store.reduce({ command: 'SLI', rawPayload: '23' });
      assert.equal(store.getState().input, 'cd');
    });

    it('should set unknown for unrecognized code', () => {
      store.reduce({ command: 'SLI', rawPayload: 'FF' });
      assert.equal(store.getState().input, 'unknown');
    });
  });

  describe('reduce — now playing', () => {
    it('should set title', () => {
      store.reduce({ command: 'NTI', rawPayload: 'My Song' });
      assert.equal(store.getState().nowPlaying.title, 'My Song');
    });

    it('should set artist', () => {
      store.reduce({ command: 'NAT', rawPayload: 'John Coltrane' });
      assert.equal(store.getState().nowPlaying.artist, 'John Coltrane');
    });

    it('should set album', () => {
      store.reduce({ command: 'NAL', rawPayload: 'A Love Supreme' });
      assert.equal(store.getState().nowPlaying.album, 'A Love Supreme');
    });
  });

  describe('reduce — playback status', () => {
    it('should detect playing', () => {
      store.reduce({ command: 'NST', rawPayload: 'P--' });
      assert.equal(store.getState().playback, 'playing');
    });

    it('should detect stopped', () => {
      store.reduce({ command: 'NST', rawPayload: 'S--' });
      assert.equal(store.getState().playback, 'stopped');
    });

    it('should detect paused (x)', () => {
      store.reduce({ command: 'NST', rawPayload: 'x--' });
      assert.equal(store.getState().playback, 'paused');
    });

    it('should detect paused (p)', () => {
      store.reduce({ command: 'NST', rawPayload: 'p--' });
      assert.equal(store.getState().playback, 'paused');
    });
  });

  describe('reduce — time', () => {
    it('should parse time format', () => {
      store.reduce({ command: 'NTM', rawPayload: '01:23/04:56' });
      const np = store.getState().nowPlaying;
      assert.equal(np.currentTime, '01:23');
      assert.equal(np.totalTime, '04:56');
    });
  });

  describe('reduce — track number', () => {
    it('should set track number', () => {
      store.reduce({ command: 'NTR', rawPayload: '0003/0012' });
      assert.equal(store.getState().nowPlaying.trackNumber, '0003/0012');
    });
  });

  describe('reduce — unknown commands', () => {
    it('should return true for known command with unchanged state', () => {
      store.reduce({ command: 'PWR', rawPayload: '01' });
      const result = store.reduce({ command: 'PWR', rawPayload: '01' });
      assert.equal(result, true);
    });

    it('should return false for unknown command', () => {
      const result = store.reduce({ command: 'XYZ', rawPayload: '123' });
      assert.equal(result, false);
    });
  });

  describe('notifications', () => {
    it('should not notify when value unchanged', () => {
      store.reduce({ command: 'PWR', rawPayload: '01' });
      let count = 0;
      store.subscribe(() => { count++; });
      store.reduce({ command: 'PWR', rawPayload: '01' }); // same value
      assert.equal(count, 0);
    });

    it('should notify when value changes', () => {
      let count = 0;
      store.subscribe(() => { count++; });
      store.reduce({ command: 'PWR', rawPayload: '01' });
      store.reduce({ command: 'PWR', rawPayload: '00' });
      assert.equal(count, 2);
    });
  });

  describe('resetNowPlaying', () => {
    it('should clear all now-playing fields', () => {
      store.reduce({ command: 'NTI', rawPayload: 'Test' });
      store.reduce({ command: 'NAT', rawPayload: 'Artist' });
      store.resetNowPlaying();
      const np = store.getState().nowPlaying;
      assert.equal(np.title, '');
      assert.equal(np.artist, '');
    });
  });
});
