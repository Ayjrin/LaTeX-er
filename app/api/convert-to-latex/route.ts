import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { convertResumeToLatex } from '@/shared/lib/gemini';

// Add detailed logging
function logApiRequest(method: string, url: string, body?: any) {
  console.log(`API Request: ${method} ${url}`);
  if (body) {
    console.log('Request body:', JSON.stringify(body, null, 2));
  }
}

function logApiResponse(status: number, body?: any) {
  console.log(`API Response: ${status}`);
  if (body) {
    console.log('Response body:', JSON.stringify(body, null, 2));
  }
}

// POST /api/convert-to-latex
export async function POST(req: NextRequest) {
  try {
    // Log the request
    logApiRequest('POST', '/api/convert-to-latex', { url: req.url });
    
    // Parse form data
    let formData;
    try {
      formData = await req.formData();
      console.log('Form data parsed successfully');
    } catch (error) {
      console.error('Error parsing form data:', error);
      const formError = error instanceof Error ? error : new Error('Unknown error parsing form data');
      const errorResponse = { error: 'Error parsing form data', details: formError.message };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    const files = formData.getAll('files');
    console.log(`Files found: ${files.length}`);
    
    if (!files || files.length === 0) {
      const errorResponse = { error: 'No files uploaded.' };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Extract file data
    const base64FilesData: string[] = [];
    const mimeTypes: string[] = [];
    const fileNames: string[] = [];
    
    console.log('Processing files for conversion to LaTeX...');
    for (const file of files) {
      if (!(file instanceof File)) {
        console.error('Invalid file object:', file);
        continue;
      }
      
      console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        base64FilesData.push(base64);
        mimeTypes.push(file.type);
        fileNames.push(file.name);
        console.log(`Successfully processed file: ${file.name}`);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        // Continue with other files instead of failing completely
        continue;
      }
    }
    
    if (base64FilesData.length === 0) {
      console.error('No valid files were processed');
      const errorResponse = { error: 'No valid files found.' };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    console.log(`Successfully processed ${base64FilesData.length} files for LaTeX conversion`);


    // Convert to LaTeX using Gemini (multi-file support)
    console.log('Calling Gemini API to convert resume to LaTeX...');
    try {
      const latexCode = await convertResumeToLatex({
        multipleFiles: true,
        base64FilesData,
        mimeTypes,
        fileNames,
      });
      
      console.log('Successfully converted resume to LaTeX');
      // Truncate the LaTeX code in logs to avoid excessive output
      const truncatedLatex = latexCode.length > 100 
        ? `${latexCode.substring(0, 100)}... (${latexCode.length} chars total)` 
        : latexCode;
      console.log('LaTeX code preview:', truncatedLatex);
      
      const successResponse = { latexCode };
      logApiResponse(200, { success: true, latexLength: latexCode.length });
      return NextResponse.json(successResponse);
    } catch (geminiError) {
      console.error('Error calling Gemini API:', geminiError);
      const apiError = geminiError instanceof Error ? geminiError : new Error('Unknown error with Gemini API');
      const errorResponse = { 
        error: 'Failed to convert resume to LaTeX', 
        details: apiError.message,
        source: 'Gemini API'
      };
      logApiResponse(500, errorResponse);
      return NextResponse.json(errorResponse, { status: 500 });
    }
  } catch (error) {
    console.error('Unhandled error in convert-to-latex route:', error);
    const serverError = error instanceof Error ? error : new Error('Unknown server error');
    const errorResponse = { 
      error: 'Internal server error', 
      details: serverError.message,
      stack: process.env.NODE_ENV === 'development' ? serverError.stack : undefined
    };
    logApiResponse(500, { error: errorResponse.error });
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
