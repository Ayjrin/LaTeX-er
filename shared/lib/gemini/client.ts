import OpenAI from 'openai';

// Initialize the OpenRouter API client (uses OpenAI SDK)
const getOpenRouterClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }
  
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LaTeX Resume Converter',
    },
  });
};

// Generation config for the model
const generationConfig = {
  temperature: 0.4,
  top_p: 1,
  max_tokens: 8192,
};

// Convert base64 data to OpenAI message content format
export const base64ToMessageContent = (
  base64Data: string,
  mimeType: string
): {
  type: "image_url";
  image_url: {
    url: string;
  };
} => {
  // For PDFs and documents, we use image_url format with data URLs
  // OpenAI's vision models can process PDFs and images this way
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mimeType};base64,${base64Data}`,
    },
  };
};

export { getOpenRouterClient, generationConfig };
