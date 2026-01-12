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
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('🚀 NEW REQUEST TO /api/convert-to-latex');
  console.log('='.repeat(80));
  
  try {
    // Log the request
    logApiRequest('POST', '/api/convert-to-latex', { url: req.url });
    console.log('📋 Request headers:', {
      'content-type': req.headers.get('content-type'),
      'content-length': req.headers.get('content-length'),
    });
    
    // Parse form data
    let formData;
    try {
      console.log('⏳ Parsing form data...');
      formData = await req.formData();
      console.log('✅ Form data parsed successfully');
      console.log('📦 Form data keys:', Array.from(formData.keys()));
    } catch (error) {
      console.error('❌ ERROR PARSING FORM DATA:', error);
      const formError = error instanceof Error ? error : new Error('Unknown error parsing form data');
      const errorResponse = { error: 'Error parsing form data', details: formError.message };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    const files = formData.getAll('files');
    console.log(`📁 Files found: ${files.length}`);
    
    if (!files || files.length === 0) {
      console.error('❌ NO FILES UPLOADED');
      const errorResponse = { error: 'No files uploaded.' };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Prepare file data for Gemini (send actual files, not extracted text)
    const base64FilesData: string[] = [];
    const mimeTypes: string[] = [];
    const fileNames: string[] = [];
    
    console.log('⚙️  Processing files for conversion to LaTeX...');
    console.log('-'.repeat(80));
    
    for (const file of files) {
      if (!(file instanceof File)) {
        console.error('❌ Invalid file object (not a File instance):', typeof file);
        continue;
      }
      
      console.log(`\n📄 Processing file: "${file.name}"`);
      console.log(`   Type: ${file.type}`);
      console.log(`   Size: ${file.size} bytes (${(file.size / 1024).toFixed(2)} KB)`);
      try {
        // Validate file type
        console.log(`   🔍 Validating file type...`);
        const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       file.name.toLowerCase().endsWith('.docx');
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        console.log(`   📋 File type check: PDF=${isPDF}, DOCX=${isDOCX}`);
        
        if (!isDOCX && !isPDF) {
          console.warn(`   ⚠️  UNSUPPORTED FILE TYPE - Skipping ${file.name}`);
          console.warn(`   Detected type: ${file.type}`);
          console.warn(`   File extension: ${file.name.split('.').pop()}`);
          continue;
        }
        
        // Convert file to base64 to send directly to Gemini
        console.log(`   🔄 Converting to base64...`);
        const arrayBuffer = await file.arrayBuffer();
        console.log(`   ✅ ArrayBuffer created: ${arrayBuffer.byteLength} bytes`);
        
        const buffer = Buffer.from(arrayBuffer);
        console.log(`   ✅ Buffer created: ${buffer.length} bytes`);
        
        const base64Data = buffer.toString('base64');
        console.log(`   ✅ Base64 encoded: ${base64Data.length} characters`);
        console.log(`   📊 Base64 preview: ${base64Data.substring(0, 50)}...`);
        
        // Determine the correct MIME type
        let mimeType = file.type;
        if (!mimeType) {
          console.log(`   ⚠️  No MIME type provided, inferring from file extension...`);
          if (isPDF) {
            mimeType = 'application/pdf';
          } else if (isDOCX) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          }
        }
        console.log(`   📝 Final MIME type: ${mimeType}`);
        
        base64FilesData.push(base64Data);
        mimeTypes.push(mimeType);
        fileNames.push(file.name);
        
        console.log(`   ✅ File prepared successfully: ${file.name}`);
        console.log(`   📦 Total base64 chars: ${base64Data.length}`);
      } catch (error) {
        console.error(`   ❌ ERROR PROCESSING FILE: ${file.name}`);
        console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
        console.error(`   Error message:`, error);
        console.error(`   Stack trace:`, error instanceof Error ? error.stack : 'N/A');
        throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n' + '-'.repeat(80));
    
    if (base64FilesData.length === 0) {
      console.error('❌ NO VALID FILES WERE PROCESSED');
      console.error('Files received:', files.length);
      console.error('Files processed:', base64FilesData.length);
      const errorResponse = { error: 'No valid files found.' };
      logApiResponse(400, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    console.log(`\n✅ Successfully processed ${base64FilesData.length} file(s)`);
    console.log('📊 Summary:');
    for (let i = 0; i < fileNames.length; i++) {
      console.log(`   ${i + 1}. ${fileNames[i]} (${mimeTypes[i]}) - ${base64FilesData[i].length} base64 chars`);
    }

    // Convert to LaTeX using Gemini (send files directly to leverage multimodal capabilities)
    console.log('\n' + '='.repeat(80));
    console.log('🤖 CALLING GEMINI API...');
    console.log('='.repeat(80));
    
    try {
      console.log('📤 Request to Gemini:');
      console.log(`   Files: ${base64FilesData.length}`);
      console.log(`   File names: ${fileNames.join(', ')}`);
      console.log(`   MIME types: ${mimeTypes.join(', ')}`);
      console.log(`   Environment check: GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
      
      const geminiStartTime = Date.now();
      const latexCode = await convertResumeToLatex({
        multipleFiles: base64FilesData.length > 1,
        base64FilesData,
        mimeTypes,
        fileNames,
      });
      const geminiDuration = Date.now() - geminiStartTime;
      
      console.log(`\n✅ GEMINI API SUCCESSFUL (${geminiDuration}ms)`);
      console.log(`📄 LaTeX code received: ${latexCode.length} characters`);
      
      // Truncate the LaTeX code in logs to avoid excessive output
      const truncatedLatex = latexCode.length > 200 
        ? `${latexCode.substring(0, 200)}... [TRUNCATED] ...${latexCode.substring(latexCode.length - 50)}` 
        : latexCode;
      console.log('📝 LaTeX preview:');
      console.log(truncatedLatex);
      
      const totalDuration = Date.now() - startTime;
      console.log(`\n⏱️  Total request duration: ${totalDuration}ms`);
      console.log('='.repeat(80));
      
      const successResponse = { latexCode };
      logApiResponse(200, { success: true, latexLength: latexCode.length });
      return NextResponse.json(successResponse);
    } catch (geminiError) {
      console.error('\n' + '❌'.repeat(40));
      console.error('❌ ERROR CALLING GEMINI API');
      console.error('❌'.repeat(40));
      console.error('Error type:', geminiError instanceof Error ? geminiError.constructor.name : typeof geminiError);
      console.error('Error message:', geminiError instanceof Error ? geminiError.message : String(geminiError));
      console.error('Full error object:', JSON.stringify(geminiError, null, 2));
      if (geminiError instanceof Error && geminiError.stack) {
        console.error('Stack trace:', geminiError.stack);
      }
      
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
    console.error('\n' + '💥'.repeat(40));
    console.error('💥 UNHANDLED ERROR IN ROUTE');
    console.error('💥'.repeat(40));
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    console.error('='.repeat(80));
    
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
