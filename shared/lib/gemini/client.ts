import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Generation config for the model
const generationConfig = {
  temperature: 0.4,
  topP: 1,
  maxOutputTokens: 8192,
};

// Convert base64 data to Gemini format (supports PDF, DOCX, images, etc.)
export const base64ToGenerativePart = (
  base64Data: string,
  mimeType: string
): {
  inlineData: {
    data: string;
    mimeType: string;
  };
} => {
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };
};

export { getGeminiClient, generationConfig };
