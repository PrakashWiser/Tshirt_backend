import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import {
  refreshAccessToken,
  generateAccessToken,
  generateRefreshToken,
  logoutUser,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

test('auth controller exposes refresh token helper and access token generator', () => {
  assert.equal(typeof refreshAccessToken, 'function');
  assert.equal(typeof generateAccessToken, 'function');
});

test('access and refresh tokens cannot be used interchangeably', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const secret = 'test-jwt-secret';
  process.env.JWT_SECRET = secret;

  try {
    const user = { _id: 'user-id', email: 'user@example.com', role: 'user' };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    assert.equal(jwt.verify(accessToken, secret).tokenType, 'access');
    assert.equal(jwt.verify(refreshToken, secret).tokenType, 'refresh');

    const protectedResponse = {
      statusCode: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await protect(
      { headers: { authorization: `Bearer ${refreshToken}` } },
      protectedResponse,
      (error) => {
        throw error;
      },
    );
    assert.equal(protectedResponse.statusCode, 401);

    const refreshResponse = {
      statusCode: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await refreshAccessToken(
      { headers: { authorization: `Bearer ${accessToken}` } },
      refreshResponse,
    );
    assert.equal(refreshResponse.statusCode, 401);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('token generation fails when JWT_SECRET is not configured', () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(
      () => generateAccessToken({ _id: 'user-id', email: 'user@example.com', role: 'user' }),
      /JWT_SECRET is not configured/,
    );
  } finally {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});

test('inactive users cannot refresh access tokens', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  const secret = 'test-jwt-secret';
  process.env.JWT_SECRET = secret;
  User.findById = () => ({
    select: async () => ({ isActive: false }),
  });
  const response = {
    statusCode: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    const token = generateRefreshToken({
      _id: 'user-id',
      email: 'user@example.com',
      role: 'user',
    });
    await refreshAccessToken(
      { headers: { authorization: `Bearer ${token}` } },
      response,
    );
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }

  assert.equal(response.statusCode, 403);
});

test('logout invalidates existing admin access and refresh tokens', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalUserUpdateOne = User.updateOne;
  const originalAuditLogCreate = AuditLog.create;
  const secret = 'test-jwt-secret';
  process.env.JWT_SECRET = secret;
  const admin = {
    _id: 'admin-id',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Admin User',
    tokenVersion: 2,
  };
  const accessToken = generateAccessToken(admin);
  const refreshToken = generateRefreshToken(admin);
  let update;
  let recordedAudit;
  const response = {
    statusCode: null,
    clearedCookie: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    clearCookie(name) {
      this.clearedCookie = name;
    },
  };

  User.updateOne = async (filter, updateDocument) => {
    update = { filter, updateDocument };
    return { modifiedCount: 1 };
  };
  AuditLog.create = async (data) => {
    recordedAudit = data;
    return data;
  };

  try {
    await logoutUser(
      { user: admin },
      response,
      (error) => {
        throw error;
      },
    );
  } finally {
    User.updateOne = originalUserUpdateOne;
    AuditLog.create = originalAuditLogCreate;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.clearedCookie, 'token');
  assert.deepEqual(update, {
    filter: { _id: admin._id },
    updateDocument: { $inc: { tokenVersion: 1 } },
  });
  assert.equal(recordedAudit.action, 'admin.logout');
  assert.equal(jwt.verify(accessToken, secret).tokenVersion, 2);
  assert.equal(jwt.verify(refreshToken, secret).tokenVersion, 2);
});

test('revoked access and refresh tokens are rejected', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalUserFindById = User.findById;
  const secret = 'test-jwt-secret';
  process.env.JWT_SECRET = secret;
  User.findById = () => ({
    select: async () => ({
      _id: 'user-id',
      email: 'user@example.com',
      role: 'user',
      isActive: true,
      tokenVersion: 3,
    }),
  });
  const user = {
    _id: 'user-id',
    email: 'user@example.com',
    role: 'user',
    tokenVersion: 2,
  };
  const makeResponse = () => ({
    statusCode: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  try {
    const accessResponse = makeResponse();
    await protect(
      { headers: { authorization: `Bearer ${generateAccessToken(user)}` } },
      accessResponse,
      (error) => {
        throw error;
      },
    );

    const refreshResponse = makeResponse();
    await refreshAccessToken(
      { headers: { authorization: `Bearer ${generateRefreshToken(user)}` } },
      refreshResponse,
    );

    assert.equal(accessResponse.statusCode, 401);
    assert.equal(refreshResponse.statusCode, 401);
    assert.match(accessResponse.body.message, /revoked/i);
    assert.match(refreshResponse.body.message, /revoked/i);
  } finally {
    User.findById = originalUserFindById;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});
