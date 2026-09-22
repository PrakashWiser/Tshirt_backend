import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '1h',
  });

export const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

const generateToken = (user) => generateAccessToken(user);

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, mobile, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 'User already exists with this email', 409);
    }

    const user = await User.create({ name, email, mobile, password, role: 'user' });
    const token = generateToken(user);

    return successResponse(res, 'User registered successfully', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
      token,
    }, 201);
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password', 401);
    }
    if (!user.isActive) {
      return errorResponse(res, 'Your account is inactive', 403);
    }
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const message = user.role === 'admin' ? 'Admin login successful' : 'User login successful';

    return successResponse(res, message, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
      token,
      accessToken: token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return errorResponse(res, 'Refresh token missing', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return errorResponse(res, 'User not found', 401);
    }

    const newAccessToken = generateAccessToken(user);

    return successResponse(res, 'Access token refreshed successfully', {
      accessToken: newAccessToken,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Refresh token expired', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid refresh token', 401);
    }
    return errorResponse(res, 'Token refresh failed', 500);
  }
};

export const logoutUser = async (req, res) => {
  res.clearCookie('token');
  return successResponse(res, 'Logged out successfully', null, 200);
};

export const getCurrentUser = async (req, res) => {
  const isAdmin = req.user && req.user.role === 'admin';
  const message = isAdmin ? 'Admin fetched successfully' : 'User fetched successfully';
  return successResponse(res, message, req.user);
};

export const updateCurrentUserProfile = async (req, res, next) => {
  try {
    const { name, email, mobile, profilePhoto } = req.body || {};

    if (!name && !email && !mobile && !profilePhoto) {
      return errorResponse(res, 'At least one profile field is required', 400);
    }

    const update = {};

    if (name) update.name = name.trim();
    if (email) update.email = email.trim().toLowerCase();
    if (mobile) update.mobile = mobile.trim();
    if (profilePhoto) update.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true }
    ).select('-password');

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, 'Profile updated successfully', user);
  } catch (error) {
    next(error);
  }
};

export const updateCurrentUserProfilePhoto = async (req, res, next) => {
  try {
    const profilePhoto = req.body?.profilePhoto || req.files?.profilePhoto?.data;

    if (!profilePhoto) {
      return errorResponse(res, 'Profile photo is required', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: typeof profilePhoto === 'string' ? profilePhoto : `/uploads/${req.files.profilePhoto.name}` },
      { new: true }
    ).select('-password');

    return successResponse(res, 'Profile photo updated successfully', user);
  } catch (error) {
    next(error);
  }
};

export const changeCurrentUserPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return errorResponse(res, 'Current password, new password, and confirmation are required', 400);
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(res, 'New password and confirm password do not match', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters long', 400);
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    return successResponse(res, 'Password changed successfully', null);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res) => {
  return successResponse(res, 'Password reset flow initiated', { email: req.body.email || null });
};

export const resetPassword = async (req, res) => {
  return successResponse(res, 'Password reset flow completed', null);
};
