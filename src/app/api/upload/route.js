import { NextResponse } from 'next/server';
import { validateRPF, extractFilenames, extractFromFilename } from '@/lib/rpfParser';
import { detectWeaponFromFilenames } from '@/lib/weapons';

// Disabled body parser config removed as it's unsupported in App Router

// Max 50MB
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 413 }
      );
    }

    // Check extension
    const filename = file.name || '';
    if (!filename.toLowerCase().endsWith('.rpf')) {
      return NextResponse.json(
        { error: 'Only .rpf files are accepted' },
        { status: 400 }
      );
    }

    // Read file into buffer (in-memory, no disk writes)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate RPF magic number
    const validation = validateRPF(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Extract filenames from the RPF buffer
    const internalFiles = extractFilenames(buffer);

    // Also extract info from the uploaded filename itself
    const filenameHints = extractFromFilename(filename);
    const allFiles = [...internalFiles, ...filenameHints];

    // Try to detect weapon
    const detectedWeapon = detectWeaponFromFilenames(allFiles);

    return NextResponse.json({
      success: true,
      filename: filename,
      fileSize: file.size,
      rpfVersion: validation.version,
      internalFiles: internalFiles.slice(0, 20), // Limit for response
      detectedWeapon: detectedWeapon,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Server error processing file' },
      { status: 500 }
    );
  }
}
