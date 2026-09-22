import Address from '../models/Address.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    return successResponse(res, 'Addresses fetched successfully', addresses);
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req, res, next) => {
  try {
    const address = await Address.create({ ...req.body, user: req.user._id });
    return successResponse(res, 'Address created successfully', address, 201);
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
    if (!address) return errorResponse(res, 'Address not found', 404);
    Object.assign(address, req.body);
    await address.save();
    return successResponse(res, 'Address updated successfully', address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    const deleted = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) return errorResponse(res, 'Address not found', 404);
    return successResponse(res, 'Address deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
