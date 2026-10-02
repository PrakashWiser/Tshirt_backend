import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateSocket } from '../middleware/socketAuthMiddleware.js';

test('socket authentication rejects missing tokens', async () => {
  let authError;
  await authenticateSocket(
    { handshake: { auth: {}, headers: {} }, data: {} },
    (error) => {
      authError = error;
    },
  );

  assert.match(authError.message, /Authentication required/);
});

test('socket authentication attaches an active user from an access token', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  const secret = 'socket-test-secret';
  const user = { _id: 'user-id', role: 'admin', isActive: true };
  const socket = { handshake: { auth: {}, headers: {} }, data: {} };
  process.env.JWT_SECRET = secret;
  User.findById = () => ({ select: async () => user });

  try {
    socket.handshake.auth.token = jwt.sign(
      { id: user._id, tokenType: 'access' },
      secret,
    );
    await authenticateSocket(socket, (error) => {
      if (error) throw error;
    });
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }

  assert.equal(socket.data.user, user);
});
