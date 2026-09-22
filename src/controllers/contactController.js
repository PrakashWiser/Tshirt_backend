import Contact from '../models/Contact.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const createContact = async (req, res, next) => {
  try {
    const contact = await Contact.create(req.body);
    return successResponse(res, 'Enquiry submitted successfully', contact, 201);
  } catch (error) {
    next(error);
  }
};

export const getContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return successResponse(res, 'Enquiries fetched successfully', contacts);
  } catch (error) {
    next(error);
  }
};

export const updateContactStatus = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return errorResponse(res, 'Enquiry not found', 404);

    contact.status = req.body.status || contact.status;
    await contact.save();
    return successResponse(res, 'Enquiry status updated successfully', contact);
  } catch (error) {
    next(error);
  }
};
