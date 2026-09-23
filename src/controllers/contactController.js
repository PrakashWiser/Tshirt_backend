import Contact from "../models/Contact.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const createContact = async (req, res, next) => {
  try {
    const contact = await Contact.create(req.body);

    const io = req.app.get("io");

    io?.to("admin").emit("new_notification", {
      notification: {
        title: "New Enquiry",
        type: "enquiry",
        createdAt: contact.createdAt,
        email: contact.email,
        mobile: contact.mobile,
        name: contact.name,
        message: contact.message,
      },
    });

    return successResponse(
      res,
      "Enquiry submitted successfully",
      contact,
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const getContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).lean();
    return successResponse(res, "Enquiries fetched successfully", contacts);
  } catch (error) {
    next(error);
  }
};

export const updateContactStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const contact = await Contact.findById(id);
    if (!contact) {
      return errorResponse(res, "Enquiry not found", 404);
    }
    if (status) {
      contact.status = status;
    }
    await contact.save();
    return successResponse(res, "Enquiry status updated successfully", contact);
  } catch (error) {
    next(error);
  }
};
