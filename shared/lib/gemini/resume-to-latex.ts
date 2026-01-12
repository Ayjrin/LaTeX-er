import {
  getOpenRouterClient,
  generationConfig,
  base64ToMessageContent,
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
  // Text-based options (for extracted content from DOCX/PDF)
  extractedTexts?: string[];
  fileNames?: string[];
  // Legacy options (kept for backward compatibility)
  multipleFiles?: boolean;
  base64FileData?: string;
  mimeType?: string;
  fileName?: string;
  base64FilesData?: string[];
  mimeTypes?: string[];
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

    const client = getOpenRouterClient();

    // Use GPT-4O through OpenRouter - best multimodal support for PDFs
    const model = "openai/gpt-4o";

    // Build messages array for OpenAI chat format
    type UserMessageContent = 
      | string
      | Array<{
          type: "text";
          text: string;
        } | {
          type: "image_url";
          image_url: {
            url: string;
          };
        }>;

    const messages: Array<
      | {
          role: "system";
          content: string;
        }
      | {
          role: "user";
          content: UserMessageContent;
        }
    > = [
      {
        role: "system",
        content: "You are a professional resume formatter that converts resumes to clean, ATS-friendly LaTeX code.",
      },
    ];

    // Primary path: Send files directly to OpenRouter (preserves formatting and layout)
    if (options.base64FilesData && options.mimeTypes) {
      console.log(`Processing ${options.base64FilesData.length} files directly (multimodal approach via OpenRouter)`);
      
      const userContent: Array<{
        type: "text";
        text: string;
      } | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }> = [
        { type: "text", text: promptWithTemplate },
      ];

      for (let i = 0; i < options.base64FilesData.length; i++) {
        const base64Data = options.base64FilesData[i];
        const mimeType = options.mimeTypes[i];

        if (base64Data && mimeType) {
          const part = base64ToMessageContent(base64Data, mimeType);
          userContent.push(part);
        }
      }

      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        userContent.push({
          type: "text",
          text: `\nNote: The following documents have been provided:\n${fileList}\n\nPlease analyze the complete documents (including formatting and layout) and create a comprehensive, professional LaTeX resume.`,
        });
      }

      messages.push({
        role: "user",
        content: userContent,
      });
    }
    // Single file path
    else if (options.base64FileData && options.mimeType) {
      console.log('Processing single file directly (multimodal approach via OpenRouter)');
      
      const part = base64ToMessageContent(
        options.base64FileData,
        options.mimeType,
      );

      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptWithTemplate },
          part,
        ],
      });
    }
    // Legacy text-based path (fallback for backward compatibility)
    else if (options.extractedTexts && options.extractedTexts.length > 0) {
      console.log(`[LEGACY] Processing ${options.extractedTexts.length} extracted text documents`);
      console.warn('Warning: Using text extraction instead of direct file processing. Consider updating to file-based approach.');
      
      let textContent = promptWithTemplate;
      
      for (let i = 0; i < options.extractedTexts.length; i++) {
        const text = options.extractedTexts[i];
        const fileName = options.fileNames?.[i] || `Document ${i + 1}`;
        
        textContent += `\n--- Resume Content from ${fileName} ---\n${text}\n--- End of Resume Content ---\n`;
      }
      
      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        textContent += `\nNote: The above content was extracted from:\n${fileList}\n\nPlease use this information to create a comprehensive, professional LaTeX resume.`;
      }

      messages.push({
        role: "user",
        content: textContent,
      });
    }
    else {
      throw new Error(
        "Invalid options: Either base64FileData, base64FilesData, or extractedTexts must be provided",
      );
    }

    // Call OpenRouter API
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      ...generationConfig,
    });

    const text = response.choices[0]?.message?.content || "";

    if (!text) {
      throw new Error("No response from OpenRouter API");
    }

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
