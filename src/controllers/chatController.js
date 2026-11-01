import OpenAI from "openai";
import { successResponse, errorResponse } from "../utils/response.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chat = async (req, res, next) => {
  try {
    const { message } = req.body;

    console.log("Received message:", message);

    if (!message?.trim()) {
      return errorResponse(res, "Message is required", 400);
    }

    const response = await openai.responses.create({
      model: "gpt-5",
      input: message.trim(),
    });

    console.log("OpenAI response:", response.output_text);

    return successResponse(res, "Chat response generated successfully", {
      reply: response.output_text,
    });
  } catch (error) {
    console.error("Chat error:", error);
    next(error);
  }
};
