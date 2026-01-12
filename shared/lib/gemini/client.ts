import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const getGeminiClient = () => {
  console.log('🔑 Getting Gemini API key...');
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set in environment variables');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')));
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  console.log(`✅ API key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('🔌 Creating GoogleGenerativeAI client...');
  const client = new GoogleGenerativeAI(apiKey);
  console.log('✅ Client created successfully');
  return client;
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
