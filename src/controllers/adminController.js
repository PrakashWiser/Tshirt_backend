import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const total = await User.countDocuments({});
    const customers = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return successResponse(res, 'Customers fetched successfully', {
      users: customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, totalProperties, totalBookings, totalRevenue] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const revenue = totalRevenue[0]?.totalRevenue || 0;

    const payload = {
      summary: {
        totalUsers,
        totalProperties,
        totalBookings,
        totalRevenue: revenue,
        totalEnquiries: 0,
      },
      distributions: {
        propertyTypes: [],
        propertyActions: [],
      },
      monthlyStats: [],
      topPerforming: {
        properties: [],
      },
      recentActivities: {
        properties: [],
      },
      totalUsers,
      totalProperties,
      totalBookings,
      totalRevenue: revenue,
    };

    return successResponse(res, 'Dashboard stats fetched successfully', payload);
  } catch (error) {
    next(error);
  }
};

export const getAdminNotifications = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    return successResponse(res, 'Notifications fetched successfully', {
      notification_: [],
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomerStatus = async (req, res, next) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }
    customer.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : customer.isActive;
    await customer.save();
    return successResponse(res, 'Customer status updated successfully', customer);
  } catch (error) {
    next(error);
  }
};
