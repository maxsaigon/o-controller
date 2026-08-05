import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configSchema } from './config.js';

describe('service bind configuration', () => {
  it('binds to IPv4 loopback by default', () => {
    const config = configSchema.parse({});

    assert.equal(config.O_CONTROL_HOST, '127.0.0.1');
  });

  it('allows an explicit non-loopback bind for opt-in deployments', () => {
    const config = configSchema.parse({ O_CONTROL_HOST: '0.0.0.0' });

    assert.equal(config.O_CONTROL_HOST, '0.0.0.0');
  });
});
