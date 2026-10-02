import Address from "../models/Address.js";
import { successResponse, errorResponse } from "../utils/response.js";

const editableAddressFields = new Set([
  "fullName",
  "mobile",
  "address",
  "city",
  "state",
  "pincode",
  "country",
  "isDefault",
]);

const buildUserAddressFilter = (addressId, userId) => ({
  _id: addressId,
  user: userId,
});

export const getAddresses = async (req, res) => {
  const addresses = await Address.find({ user: req.user._id }).sort({
    isDefault: -1,
    createdAt: -1,
  });
  return successResponse(res, "Addresses fetched successfully", addresses);
};

export const createAddress = async (req, res) => {
  const address = await Address.create({ ...req.body, user: req.user._id });
  return successResponse(res, "Address created successfully", address, 201);
};

export const updateAddress = async (req, res) => {
  const address = await Address.findOne(
    buildUserAddressFilter(req.params.id, req.user._id),
  );
  if (!address) return errorResponse(res, "Address not found", 404);

  const updates = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([field]) =>
      editableAddressFields.has(field),
    ),
  );
  Object.assign(address, updates);
  await address.save();
  return successResponse(res, "Address updated successfully", address);
};

export const deleteAddress = async (req, res) => {
  const deleted = await Address.findOneAndDelete(
    buildUserAddressFilter(req.params.id, req.user._id),
  );
  if (!deleted) return errorResponse(res, "Address not found", 404);

  return successResponse(res, "Address deleted successfully", null);
};
