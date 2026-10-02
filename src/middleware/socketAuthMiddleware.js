import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/jwt.js';

export const authenticateSocket = async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      typeof authToken === 'string' && authToken
        ? authToken
        : typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : null;

    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.tokenType !== 'access') {
      return next(new Error('Invalid token'));
    }

    const user = await User.findById(decoded.id).select('_id role isActive');
    if (!user?.isActive) return next(new Error('Invalid token'));

    socket.data.user = user;
    return next();
  } catch {
    return next(new Error('Authentication failed'));
  }
};
