import {
  getGeminiClient,
  safetySettings,
  generationConfig,
  base64ToGenerativePart,
} from "./client";
import fs from "fs";
import path from "path";

// Read the LaTeX template file
const getResumeTemplate = (): string => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "shared",
      "templates",
      "resume-template.txt",
    );
    return fs.readFileSync(templatePath, "utf8");
  } catch (error) {
    console.error("Error reading resume template:", error);
    return ""; // Return empty string if template can't be read
  }
};

// The prompt template for converting a resume to LaTeX
const createPrompt = (template: string) => {
  return `
You are a professional resume formatter that converts various resume formats into clean, professional LaTeX code.

GOAL: Make a clean and professional resume using the target documents pushing that data into the LaTeX template.

INSTRUCTIONS:
1. Analyze the provided resume document carefully.
2. Extract all relevant information including:
   - Contact details (name, email, phone, location, website, LinkedIn, GitHub)
   - Education history
   - Work experience
   - Skills
   - Projects
   - Certifications
   - Awards
   - Any other relevant sections
3. Use the provided LaTeX template below and fill it with the extracted information.
4. Ensure the formatting is clean, professional, and ATS-friendly.
5. Maintain the original content but improve organization and presentation.
6. Return ONLY the complete LaTeX code without any explanations or comments outside the code.
7. Keep the length to that which would make a single page pdf.

IMPORTANT:
- Use the provided template structure and commands.
- Do not change the LaTeX preamble or package imports.
- Ensure the document is complete and ready to compile.
- Optimize spacing and layout for a one-page resume when possible.
- Do not add any information that is not in the original resume.
- Do not use the provided documents for formatting at all. only use it as information.
- Only use the provided LaTeX template as a reference for the structure and commands.
- Do not keep any template information in the final resume -- only use the resume for formatting, not for content.


TEMPLATE TO USE:
\`\`\`latex
${template}
\`\`\`
`;
};

interface ConvertResumeToLatexOptions {
  multipleFiles?: boolean;
  // Single file options
  base64FileData?: string;
  mimeType?: string;
  fileName?: string;
  // Multiple files options
  base64FilesData?: string[];
  mimeTypes?: string[];
  fileNames?: string[];
  extractedTexts?: string[]; // For DOCX files that have been converted to text
}

/**
 * Converts resume documents to LaTeX format using Gemini AI
 * Supports both single and multiple file uploads
 */
export async function convertResumeToLatex(
  options: ConvertResumeToLatexOptions,
): Promise<string> {
  try {
    // Get the LaTeX template
    const template = getResumeTemplate();

    // Create the prompt with the template
    const promptWithTemplate = createPrompt(template);

    const genAI = getGeminiClient();

    // Get the Gemini 2.5 Flash model that can process text and images
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
      generationConfig,
    });

    // Array to hold all content parts for the model
    // Define a type that can accept both strings and inline data objects
    type ContentPart =
      | string
      | { inlineData: { data: string; mimeType: string } };
    const contentParts: ContentPart[] = [promptWithTemplate];

    if (options.multipleFiles && options.base64FilesData && options.mimeTypes) {
      // Handle multiple files
      for (let i = 0; i < options.base64FilesData.length; i++) {
        const base64Data = options.base64FilesData[i];
        const mimeType = options.mimeTypes[i];
        const extractedText = options.extractedTexts?.[i];

        // If we have extracted text (from DOCX), use that instead of base64
        if (extractedText) {
          console.log(`Adding extracted text for file ${i} (${extractedText.length} chars)`);
          contentParts.push(`\n--- Document Content from ${options.fileNames?.[i] || 'uploaded file'} ---\n${extractedText}\n--- End of Document ---\n`);
        } else if (base64Data && mimeType) {
          // Create a part from the base64 data (for PDF, images, etc.)
          const part = await base64ToGenerativePart(base64Data, mimeType);
          contentParts.push(part);
        }
      }

      // Add a note about multiple documents if we have file names
      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        contentParts.push(
          `Note: The following documents have been provided:\n${fileList}\n\nPlease extract information from all documents and create a comprehensive resume.`,
        );
      }
    } else if (options.base64FileData && options.mimeType) {
      // Handle single file for backward compatibility
      const part = await base64ToGenerativePart(
        options.base64FileData,
        options.mimeType,
      );
      contentParts.push(part);
    } else {
      throw new Error(
        "Invalid options: Either base64FileData or base64FilesData must be provided",
      );
    }

    // Generate content using the model with all parts
    const result = await model.generateContent(contentParts);

    const response = await result.response;
    const text = response.text();

    // Extract just the LaTeX code if it's wrapped in markdown code blocks
    const latexCode = extractLatexCode(text);

    return latexCode;
  } catch (error) {
    console.error("Error converting resume to LaTeX:", error);
    throw new Error(
      `Failed to convert resume to LaTeX: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Helper function to extract LaTeX code from the response
 * This handles cases where the model might wrap the code in markdown code blocks
 */
function extractLatexCode(text: string): string {
  // Check if the text is wrapped in markdown LaTeX code blocks
  const latexCodeBlockRegex = /```(?:latex)?\s*([\s\S]*?)```/;
  const match = text.match(latexCodeBlockRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // If no code blocks found, return the original text
  return text.trim();
}
