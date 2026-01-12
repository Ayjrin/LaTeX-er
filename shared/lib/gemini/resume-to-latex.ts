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
  console.log('\n🔧 convertResumeToLatex() called');
  console.log('📥 Options received:', {
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
    console.log('📋 Loading LaTeX template...');
    const template = getResumeTemplate();
    console.log(`✅ Template loaded: ${template.length} characters`);

    // Create the prompt with the template
    console.log('✍️  Creating prompt...');
    const promptWithTemplate = createPrompt(template);
    console.log(`✅ Prompt created: ${promptWithTemplate.length} characters`);

    console.log('🔌 Initializing Gemini client...');
    const genAI = getGeminiClient();
    console.log('✅ Gemini client initialized');

    // Use Gemini 2.5 Pro - natively supports PDF, DOCX, images, and more
    console.log('🤖 Getting Gemini model: gemini-2.5-pro');
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig,
    });
    console.log('✅ Model initialized with config:', generationConfig);

    // Build content parts for Gemini
    console.log('📦 Building content parts...');
    const contentParts: Array<string | { inlineData: { data: string; mimeType: string } }> = [
      promptWithTemplate
    ];
    console.log(`   Added prompt to content parts (${promptWithTemplate.length} chars)`);

    // Primary path: Send files directly to Gemini (preserves formatting and layout)
    if (options.base64FilesData && options.mimeTypes) {
      console.log(`📁 Processing ${options.base64FilesData.length} file(s) directly (multimodal via Gemini)`);
      
      for (let i = 0; i < options.base64FilesData.length; i++) {
        const base64Data = options.base64FilesData[i];
        const mimeType = options.mimeTypes[i];
        const fileName = options.fileNames?.[i] || `File ${i + 1}`;

        console.log(`\n   📄 File ${i + 1}/${options.base64FilesData.length}: ${fileName}`);
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
          console.log(`      ✅ Added to content parts (total: ${contentParts.length})`);
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
      console.log('Processing single file directly (multimodal via Gemini)');
      
      const part = base64ToGenerativePart(
        options.base64FileData,
        options.mimeType,
      );
      contentParts.push(part);
    }
    // Legacy text-based path (fallback for backward compatibility)
    else if (options.extractedTexts && options.extractedTexts.length > 0) {
      console.log(`[LEGACY] Processing ${options.extractedTexts.length} extracted text documents`);
      console.warn('Warning: Using text extraction instead of direct file processing.');
      
      for (let i = 0; i < options.extractedTexts.length; i++) {
        const text = options.extractedTexts[i];
        const fileName = options.fileNames?.[i] || `Document ${i + 1}`;
        
        contentParts.push(
          `\n--- Resume Content from ${fileName} ---\n${text}\n--- End of Resume Content ---\n`
        );
      }
      
      if (options.fileNames && options.fileNames.length > 0) {
        const fileList = options.fileNames
          .map((name) => `- ${name}`)
          .join("\n");
        contentParts.push(
          `\nNote: The above content was extracted from:\n${fileList}\n\nPlease use this information to create a comprehensive, professional LaTeX resume.`
        );
      }
    }
    else {
      throw new Error(
        "Invalid options: Either base64FileData, base64FilesData, or extractedTexts must be provided",
      );
    }

    // Call Gemini API
    console.log('\n🚀 Calling Gemini API with generateContent()...');
    console.log(`   Content parts to send: ${contentParts.length}`);
    console.log(`   Parts breakdown:`);
    contentParts.forEach((part, idx) => {
      if (typeof part === 'string') {
        console.log(`      ${idx + 1}. String (${part.length} chars)`);
      } else {
        console.log(`      ${idx + 1}. File (${part.inlineData.mimeType}, ${part.inlineData.data.length} base64 chars)`);
      }
    });
    
    const apiStartTime = Date.now();
    const result = await model.generateContent(contentParts);
    const apiDuration = Date.now() - apiStartTime;
    console.log(`\n✅ Gemini API responded in ${apiDuration}ms`);
    
    console.log('📥 Getting response...');
    const response = await result.response;
    console.log('✅ Response received');
    
    console.log('📄 Extracting text...');
    const text = response.text();
    console.log(`✅ Text extracted: ${text.length} characters`);

    if (!text) {
      console.error('❌ NO TEXT IN RESPONSE');
      throw new Error("No response from Gemini API");
    }

    // Extract just the LaTeX code if it's wrapped in markdown code blocks
    console.log('🔍 Extracting LaTeX code from response...');
    const latexCode = extractLatexCode(text);
    console.log(`✅ LaTeX code extracted: ${latexCode.length} characters`);
    console.log(`📝 First 100 chars: ${latexCode.substring(0, 100)}...`);

    return latexCode;
  } catch (error) {
    console.error('\n❌❌❌ ERROR IN convertResumeToLatex() ❌❌❌');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
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
