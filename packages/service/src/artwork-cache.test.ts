import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtworkCache } from './artwork-cache.js';

test('artwork cache expires entries and refreshes LRU order', () => {
  const cache = new ArtworkCache(2, 100, 10);
  cache.set('a', { buffer: Buffer.from('a'), contentType: 'image/jpeg' }, 0);
  cache.set('b', { buffer: Buffer.from('b'), contentType: 'image/jpeg' }, 0);
  assert.equal(cache.get('a', 1)?.buffer.toString(), 'a');
  cache.set('c', { buffer: Buffer.from('c'), contentType: 'image/jpeg' }, 1);
  assert.equal(cache.get('b', 1), undefined);
  assert.equal(cache.get('a', 11), undefined);
});

test('artwork cache evicts entries to remain under the byte budget', () => {
  const cache = new ArtworkCache(10, 3, 100);
  cache.set('a', { buffer: Buffer.from('aa'), contentType: 'image/jpeg' }, 0);
  cache.set('b', { buffer: Buffer.from('bb'), contentType: 'image/png' }, 0);
  assert.equal(cache.get('a', 1), undefined);
  assert.equal(cache.get('b', 1)?.contentType, 'image/png');
  assert.deepEqual(cache.stats(), { entries: 1, bytes: 2, hits: 1, misses: 1 });
});
