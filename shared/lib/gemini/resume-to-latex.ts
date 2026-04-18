import {
  getGeminiClient,
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

CRITICAL: A PDF resume document will be provided to you directly. You MUST read and extract ALL information from this PDF file.

GOAL: Convert the provided resume PDF into a professional LaTeX document using the template structure below.

INSTRUCTIONS:
1. **READ THE PDF FILE**: Carefully analyze the PDF resume that has been uploaded. Extract ALL text, structure, and information from it.
2. **Extract ALL information** from the PDF including:
   - Contact details (name, email, phone, location, website, LinkedIn, GitHub)
   - Education history (schools, degrees, dates, GPA if present)
   - Work experience (company names, job titles, dates, responsibilities, achievements)
   - Skills (technical skills, languages, tools, frameworks)
   - Projects (names, descriptions, technologies used)
   - Certifications
   - Awards and honors
   - Publications, volunteer work, or any other relevant sections
3. **Use the LaTeX template structure** provided below as your formatting guide.
4. **Fill in the template** with the actual content from the PDF resume.
5. **Return ONLY the complete LaTeX code** - no explanations, no markdown formatting, just pure LaTeX.
6. **Keep it concise** to fit on a single page when compiled.

CRITICAL REQUIREMENTS - READ THIS CAREFULLY:
- READ the PDF resume file that is attached to this message
- Extract ALL text and information from the PDF
- Replace ALL "Lorem Ipsum" placeholder text with ACTUAL content from the PDF
- Replace "Lorem Ipsum University" with the ACTUAL university name from the PDF
- Replace "Lorem Ipsum Corporation" with the ACTUAL company names from the PDF
- Replace "20XX" and "20YY" with ACTUAL dates from the PDF
- Replace "email@example.com" with the ACTUAL email from the PDF
- Use the LaTeX commands and structure from the template but with REAL content
- Do NOT leave ANY placeholder text (Lorem, Ipsum, Dolor, Sit, Amet, etc.) in the output
- Include ALL sections that appear in the original resume
- Return a complete, compilable LaTeX document starting with \\documentclass and ending with \\end{document}
- If there is both CERTIFICATIONS & TECHNICAL SKILLS included, use the mini page section provided. Otherwise, use the individual sections if the user only provides one of the two.
- Make sure that every section uses the same font.

TEMPLATE STRUCTURE (use these LaTeX commands but replace ALL content with real data from the PDF):
\`\`\`latex
${template}
\`\`\`

IMPORTANT: The template above contains placeholder text like "Lorem Ipsum", "Lorem Ipsum University", "Lorem Ipsum Corporation", etc.
These are ONLY examples of the structure. You MUST replace ALL of these placeholders with the ACTUAL information from the provided PDF resume.
Do NOT copy any "Lorem", "Ipsum", "Dolor", "Sit", "Amet" or other placeholder text into your output!
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
  console.log("\n🔧 convertResumeToLatex() called");
  console.log("📥 Options received:", {
    hasExtractedTexts: !!options.extractedTexts,
    extractedTextsLength: options.extractedTexts?.length,
    hasBase64FilesData: !!options.base64FilesData,
    base64FilesDataLength: options.base64FilesData?.length,
    hasMimeTypes: !!options.mimeTypes,
    mimeTypesLength: options.mimeTypes?.length,
    hasFileNames: !!options.fileNames,
    fileNamesLength: options.fileNames?.length,
    multipleFiles: options.multipleFiles,
  });

  try {
    // Get the LaTeX template
    console.log("📋 Loading LaTeX template...");
    const template = getResumeTemplate();
    console.log(`✅ Template loaded: ${template.length} characters`);

    // Create the prompt with the template
    console.log("✍️  Creating prompt...");
    const promptWithTemplate = createPrompt(template);
    console.log(`✅ Prompt created: ${promptWithTemplate.length} characters`);

    console.log("🔌 Initializing Gemini client...");
    const genAI = getGeminiClient();
    console.log("✅ Gemini client initialized");

    // Use Gemini 1.5 Pro - stable model with multimodal support (PDF, DOCX, images)
    console.log("🤖 Getting Gemini model: gemini-1.5-pro-002");
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-002",
      generationConfig,
    });
    console.log("✅ Model initialized with config:", generationConfig);

    // Build content parts for Gemini
    console.log("📦 Building content parts...");
    const contentParts: Array<
      string | { inlineData: { data: string; mimeType: string } }
    > = [promptWithTemplate];
    console.log(
      `   Added prompt to content parts (${promptWithTemplate.length} chars)`,
    );

    // Primary path: Send files directly to Gemini (preserves formatting and layout)
    if (options.base64FilesData && options.mimeTypes) {
      console.log(
        `📁 Processing ${options.base64FilesData.length} file(s) directly (multimodal via Gemini)`,
      );

      for (let i = 0; i < options.base64FilesData.length; i++) {
        const base64Data = options.base64FilesData[i];
        const mimeType = options.mimeTypes[i];
        const fileName = options.fileNames?.[i] || `File ${i + 1}`;

        console.log(
          `\n   📄 File ${i + 1}/${options.base64FilesData.length}: ${fileName}`,
        );
        console.log(`      MIME type: ${mimeType}`);
        console.log(`      Base64 length: ${base64Data.length} chars`);
        console.log(`      First 30 chars: ${base64Data.substring(0, 30)}...`);

        if (base64Data && mimeType) {
          console.log(`      🔄 Converting to Gemini part...`);
          const part = base64ToGenerativePart(base64Data, mimeType);
          console.log(`      ✅ Part created:`, {
            hasInlineData: !!part.inlineData,
            mimeType: part.inlineData?.mimeType,
            dataLength: part.inlineData?.data?.length,
          });
          contentParts.push(part);
          console.log(
            `      ✅ Added to content parts (total: ${contentParts.length})`,
          );
        } else {
          console.warn(`      ⚠️  Skipping file - missing data or MIME type`);
        }
      }

      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        const note = `\nNote: The following documents have been provided:\n${fileList}\n\nPlease analyze the complete documents (including formatting and layout) and create a comprehensive, professional LaTeX resume.`;
        console.log(`\n   📝 Adding file list note (${note.length} chars)`);
        contentParts.push(note);
      }

      console.log(`\n✅ Total content parts: ${contentParts.length}`);
    }
    // Single file path
    else if (options.base64FileData && options.mimeType) {
      console.log("Processing single file directly (multimodal via Gemini)");

      const part = base64ToGenerativePart(
        options.base64FileData,
        options.mimeType,
      );
      contentParts.push(part);
    }
    // Legacy text-based path (fallback for backward compatibility)
    else if (options.extractedTexts && options.extractedTexts.length > 0) {
      console.log(
        `[LEGACY] Processing ${options.extractedTexts.length} extracted text documents`,
      );
      console.warn(
        "Warning: Using text extraction instead of direct file processing.",
      );

      for (let i = 0; i < options.extractedTexts.length; i++) {
        const text = options.extractedTexts[i];
        const fileName = options.fileNames?.[i] || `Document ${i + 1}`;

        contentParts.push(
          `\n--- Resume Content from ${fileName} ---\n${text}\n--- End of Resume Content ---\n`,
        );
      }

      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        contentParts.push(
          `\nNote: The above content was extracted from:\n${fileList}\n\nPlease use this information to create a comprehensive, professional LaTeX resume.`,
        );
      }
    } else {
      throw new Error(
        "Invalid options: Either base64FileData, base64FilesData, or extractedTexts must be provided",
      );
    }

    // Call Gemini API
    console.log("\n🚀 Calling Gemini API with generateContent()...");
    console.log(`   Content parts to send: ${contentParts.length}`);
    console.log(`   Parts breakdown:`);
    contentParts.forEach((part, idx) => {
      if (typeof part === "string") {
        console.log(`      ${idx + 1}. String (${part.length} chars)`);
        if (part.length < 500) {
          console.log(`         Preview: ${part.substring(0, 200)}...`);
        }
      } else {
        console.log(
          `      ${idx + 1}. File (${part.inlineData.mimeType}, ${part.inlineData.data.length} base64 chars)`,
        );
        console.log(
          `         Base64 starts with: ${part.inlineData.data.substring(0, 50)}...`,
        );
      }
    });

    const apiStartTime = Date.now();
    const result = await model.generateContent(contentParts);
    const apiDuration = Date.now() - apiStartTime;
    console.log(`\n✅ Gemini API responded in ${apiDuration}ms`);
    console.log(`   Response structure:`, {
      hasResponse: !!result.response,
      hasCandidates: !!result.response?.candidates,
      candidatesCount: result.response?.candidates?.length,
    });

    console.log("📥 Getting response...");
    const response = await result.response;
    console.log("✅ Response received");

    console.log("📄 Extracting text...");
    const text = response.text();
    console.log(`✅ Raw text extracted: ${text.length} characters`);
    console.log(
      `📝 Raw text preview (first 500 chars):\n${text.substring(0, 500)}`,
    );
    console.log(
      `📝 Raw text end (last 200 chars):\n${text.substring(Math.max(0, text.length - 200))}`,
    );

    if (!text) {
      console.error("❌ NO TEXT IN RESPONSE");
      throw new Error("No response from Gemini API");
    }

    if (text.length < 100) {
      console.warn(
        `⚠️  WARNING: Response is very short (${text.length} chars)`,
      );
      console.warn(`   Full response: "${text}"`);
    }

    // Extract just the LaTeX code if it's wrapped in markdown code blocks
    console.log("🔍 Extracting LaTeX code from response...");
    const latexCode = extractLatexCode(text);
    console.log(`✅ LaTeX code extracted: ${latexCode.length} characters`);
    console.log(`📝 First 200 chars: ${latexCode.substring(0, 200)}...`);
    console.log(
      `📝 Last 200 chars: ...${latexCode.substring(Math.max(0, latexCode.length - 200))}`,
    );

    // Check if the response still contains placeholder text
    if (latexCode.includes("Lorem") || latexCode.includes("Ipsum")) {
      console.warn(
        '\n⚠️⚠️⚠️  WARNING: LaTeX output contains "Lorem" or "Ipsum" placeholder text!',
      );
      console.warn(
        "   This suggests the AI did not properly replace template placeholders with actual resume content.",
      );
      console.warn(
        "   The PDF may not have been read correctly, or the prompt was not followed.",
      );
    }

    return latexCode;
  } catch (error) {
    console.error("\n❌❌❌ ERROR IN convertResumeToLatex() ❌❌❌");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Full error:", error);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
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
