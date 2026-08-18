import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMusicCatalog } from './music-catalog.js';

test('normalizes tracks into albums and artists and sorts track numbers', () => {
  const catalog = normalizeMusicCatalog([
    { id: '2', parentId: 'album', type: 'item', title: '02. Second', artist: 'A', album: 'Record', resourceUrl: 'u2' },
    { id: '1', parentId: 'album', type: 'item', title: '01. First', artist: 'A', album: 'Record', resourceUrl: 'u1' },
  ]);

  assert.equal(catalog.albums.length, 1);
  assert.deepEqual(catalog.albums[0].tracks.map((track) => track.id), ['1', '2']);
  assert.equal(catalog.artists[0].albums[0].id, 'album:record');
});

test('skips non-playable items and falls back to parent for unknown album', () => {
  const catalog = normalizeMusicCatalog([
    { id: 'folder', parentId: 'root', type: 'container', title: 'Folder' },
    { id: 'no-url', parentId: 'folder', type: 'item', title: 'Broken' },
    { id: 'ok', parentId: 'folder', type: 'item', title: 'Track', resourceUrl: 'url' },
  ]);

  assert.equal(catalog.albums[0].id, 'album:folder');
  assert.equal(catalog.artists.length, 0);
});
