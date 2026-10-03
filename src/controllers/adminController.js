import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Contact from '../models/Contact.js';
import Category from '../models/Category.js';
import AuditLog from '../models/AuditLog.js';
import { successResponse, errorResponse } from '../utils/response.js';
import recordAuditLog from '../utils/auditLog.js';

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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [totalUsers, totalProducts, totalOrders, revenueTotals, totalEnquiries, topProducts, productTypes, monthlyStats, orders, users, auditLogs] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        {
          $match: {
            $or: [
              { paymentStatus: 'paid' },
              { paymentMethod: 'cod', orderStatus: 'delivered' },
            ],
          },
        },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      Contact.countDocuments(),
      Order.aggregate([
        { $match: { orderStatus: { $nin: ['cancelled', 'returned', 'refunded'] } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            quantitySold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { quantitySold: -1, revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: Product.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $project: {
            _id: 1,
            name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, '$name'] },
            image: { $arrayElemAt: [{ $arrayElemAt: ['$product.images', 0] }, 0] },
            quantitySold: 1,
            revenue: 1,
          },
        },
      ]),
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        {
          $lookup: {
            from: Category.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $project: {
            _id: { $ifNull: [{ $arrayElemAt: ['$category.name', 0] }, 'Uncategorized'] },
            count: 1,
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart },
            $or: [
              { paymentStatus: 'paid' },
              { paymentMethod: 'cod', orderStatus: 'delivered' },
            ],
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'name email')
        .populate('items.product', 'images variants.images')
        .lean(),
      User.find({ role: 'user' }).select('name email createdAt').sort({ createdAt: -1 }).limit(10).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'name email').lean(),
    ]);

    const revenue = revenueTotals[0]?.totalRevenue || 0;
    const recentActivities = [
      ...orders.map((order) => ({
        type: 'order',
        action: 'order.created',
        description: `Order ${order.orderNumber} was placed`,
        createdAt: order.createdAt,
        actor: order.user,
        resourceId: order._id,
        image: order.items?.find((item) => item.product?.images?.length || item.product?.variants?.some((variant) => variant.images?.length))
          ?.product?.images?.[0] ||
          order.items?.find((item) => item.product?.variants?.some((variant) => variant.images?.length))
            ?.product?.variants?.find((variant) => variant.images?.length)?.images?.[0] ||
          '',
        metadata: { orderNumber: order.orderNumber, orderStatus: order.orderStatus, totalAmount: order.totalAmount },
      })),
      ...users.map((user) => ({
        type: 'user',
        action: 'user.registered',
        description: `${user.name} created an account`,
        createdAt: user.createdAt,
        actor: user,
        resourceId: user._id,
        metadata: {},
      })),
      ...auditLogs.filter((log) => log.action !== 'order.created').map((log) => ({
        type: 'audit',
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
        actor: log.actor,
        resourceId: log.resourceId,
        image: log.metadata?.image || '',
        metadata: log.metadata,
      })),
    ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 10);

    const payload = {
      summary: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: revenue,
        totalEnquiries,
      },
      distributions: {
        productTypes,
      },
      monthlyStats: monthlyStats.map((stat) => ({
        year: stat._id.year,
        month: stat._id.month,
        orders: stat.orders,
        revenue: stat.revenue,
      })),
      topPerforming: {
        products: topProducts,
      },
      recentActivities: { activities: recentActivities, orders, users, auditLogs },
      topProducts,
      auditLogs,
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenue,
      totalEnquiries,
    };

    return successResponse(res, 'Dashboard stats fetched successfully', payload);
  } catch (error) {
    next(error);
  }
};

export const getAdminNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const [auditLogs, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email mobile')
        .lean(),
      AuditLog.countDocuments(),
    ]);
    const notifications = auditLogs.map((log) => ({
      _id: log._id,
      message: log.description,
      timestamp: log.createdAt.toISOString(),
      severity: log.action.endsWith('.deleted')
        ? 'CRITICAL'
        : log.action.endsWith('.status_changed') || log.action.endsWith('.cancelled')
          ? 'WARNING'
          : log.action.endsWith('.verified')
            ? 'SUCCESS'
            : 'INFO',
      fullName: log.actor?.name || log.metadata?.name || '',
      email: log.actor?.email || '',
      phone: log.actor?.mobile || log.metadata?.mobile || '',
      category: log.resource,
      propertyId: log.resourceId?.toString() || '',
      isRead: false,
      specialRequest: '',
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      metadata: log.metadata,
    }));

    return successResponse(res, 'Notifications fetched successfully', {
      notification_: notifications,
      notifications,
      auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const filter = {};
    if (req.query.resource) filter.resource = String(req.query.resource);
    if (req.query.action) filter.action = String(req.query.action);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email mobile')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return successResponse(res, 'Audit logs fetched successfully', {
      logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
    const previousStatus = customer.isActive;
    customer.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : customer.isActive;
    await customer.save();
    if (previousStatus !== customer.isActive) {
      await recordAuditLog(req, {
        action: 'customer.status_changed',
        resource: 'customer',
        resourceId: customer._id,
        description: `Customer ${customer.name} was ${customer.isActive ? 'activated' : 'deactivated'}`,
        metadata: { isActive: customer.isActive },
      });
    }
    return successResponse(res, 'Customer status updated successfully', customer);
  } catch (error) {
    next(error);
  }
};
