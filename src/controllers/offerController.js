import Offer from '../models/Offer.js';
import { successResponse, errorResponse } from '../utils/response.js';
import recordAuditLog from '../utils/auditLog.js';

export const getAllOffers = async (req, res, next) => {
  try {
    const offers = await Offer.find().sort({ startAt: -1 });
    return successResponse(res, 'Offers fetched successfully', { offers });
  } catch (error) {
    next(error);
  }
};

export const getOfferById = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return errorResponse(res, 'Offer not found', 404);
    return successResponse(res, 'Offer fetched successfully', offer);
  } catch (error) {
    next(error);
  }
};

export const createOffer = async (req, res, next) => {
  try {
    const { title, message, discountPercent, startAt, endAt } = req.body || {};

    if (!title || !discountPercent || !startAt || !endAt) {
      return errorResponse(res, 'Title, discount, start time and end time are required', 400);
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return errorResponse(res, 'Offer start time must be before end time', 400);
    }

    const offer = await Offer.create({
      title: title.trim(),
      message: (message || '').trim(),
      discountPercent: Number(discountPercent),
      startAt: start,
      endAt: end,
      isActive: true,
      createdBy: req.user?._id || null,
    });

    await recordAuditLog(req, {
      action: 'offer.created',
      resource: 'offer',
      resourceId: offer._id,
      description: `Offer ${offer.title} was created`,
      metadata: { title: offer.title, startAt: offer.startAt, endAt: offer.endAt },
    });

    return successResponse(res, 'Offer created successfully', offer, 201);
  } catch (error) {
    next(error);
  }
};

export const updateOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return errorResponse(res, 'Offer not found', 404);

    const { title, message, discountPercent, startAt, endAt, isActive } = req.body || {};

    if (title) offer.title = title.trim();
    if (message !== undefined) offer.message = message.trim();
    if (discountPercent) offer.discountPercent = Number(discountPercent);
    if (startAt) offer.startAt = new Date(startAt);
    if (endAt) offer.endAt = new Date(endAt);
    if (typeof isActive === 'boolean') offer.isActive = isActive;

    if (offer.startAt >= offer.endAt) {
      return errorResponse(res, 'Offer start time must be before end time', 400);
    }

    await offer.save();

    await recordAuditLog(req, {
      action: 'offer.updated',
      resource: 'offer',
      resourceId: offer._id,
      description: `Offer ${offer.title} was updated`,
      metadata: { title: offer.title },
    });

    return successResponse(res, 'Offer updated successfully', offer);
  } catch (error) {
    next(error);
  }
};

export const deleteOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return errorResponse(res, 'Offer not found', 404);

    await recordAuditLog(req, {
      action: 'offer.deleted',
      resource: 'offer',
      resourceId: offer._id,
      description: `Offer ${offer.title} was deleted`,
    });

    return successResponse(res, 'Offer deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

export const updateOfferStatus = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return errorResponse(res, 'Offer not found', 404);

    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : offer.isActive;
    offer.isActive = isActive;
    await offer.save();

    return successResponse(res, 'Offer status updated successfully', offer);
  } catch (error) {
    next(error);
  }
};
