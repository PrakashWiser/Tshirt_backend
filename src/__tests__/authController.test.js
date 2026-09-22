import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshAccessToken, generateAccessToken } from '../controllers/authController.js';

test('auth controller exposes refresh token helper and access token generator', () => {
  assert.equal(typeof refreshAccessToken, 'function');
  assert.equal(typeof generateAccessToken, 'function');
});
