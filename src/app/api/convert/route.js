import { NextResponse } from 'next/server';
import { validateRPF, extractFilenames } from '@/lib/rpfParser';
import { WEAPON_MAP } from '@/lib/weapons';

// Disabled body parser config removed as it's unsupported in App Router

const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const sourceWeapon = formData.get('sourceWeapon');
    const targetWeapon = formData.get('targetWeapon');

    if (!file || !sourceWeapon || !targetWeapon) {
      return NextResponse.json(
        { error: 'Missing required fields: file, sourceWeapon, targetWeapon' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 413 }
      );
    }

    // Read buffer in memory
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate RPF
    const validation = validateRPF(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Validate weapon IDs
    const sourceName = WEAPON_MAP[sourceWeapon.toLowerCase()];
    const targetName = WEAPON_MAP[targetWeapon.toLowerCase()];

    if (!sourceName || !targetName) {
      return NextResponse.json(
        { error: 'Invalid weapon selection' },
        { status: 400 }
      );
    }

    // Perform the conversion in memory
    // The conversion replaces all occurrences of the source weapon ID
    // with the target weapon ID in the binary buffer
    const convertedBuffer = performConversion(buffer, sourceWeapon, targetWeapon);

    // Return the converted file as a download
    const targetFilename = `${targetWeapon}.rpf`;

    return new Response(convertedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${targetFilename}"`,
        'Content-Length': convertedBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('Convert error:', err);
    return NextResponse.json(
      { error: 'Server error during conversion' },
      { status: 500 }
    );
  }
}

/**
 * Perform weapon skin conversion by replacing source weapon references
 * with target weapon references in the RPF buffer.
 *
 * This is done entirely in-memory (stateless).
 */
function performConversion(buffer, sourceId, targetId) {
  const result = Buffer.from(buffer);

  // Replace ASCII occurrences of source weapon ID with target
  const sourceBytes = Buffer.from(sourceId, 'ascii');
  const targetBytes = Buffer.from(targetId, 'ascii');

  // Handle different lengths by padding with nulls or truncating
  const maxLen = Math.max(sourceBytes.length, targetBytes.length);
  const paddedTarget = Buffer.alloc(sourceBytes.length, 0);
  targetBytes.copy(paddedTarget, 0, 0, Math.min(targetBytes.length, sourceBytes.length));

  let offset = 0;
  while (offset < result.length - sourceBytes.length) {
    const idx = result.indexOf(sourceBytes, offset);
    if (idx === -1) break;

    paddedTarget.copy(result, idx);
    offset = idx + sourceBytes.length;
  }

  // Also handle case-insensitive variants
  const sourceLower = sourceId.toLowerCase();
  const sourceUpper = sourceId.toUpperCase();

  if (sourceLower !== sourceId) {
    const srcBuf = Buffer.from(sourceLower, 'ascii');
    const tgtBuf = Buffer.alloc(srcBuf.length, 0);
    Buffer.from(targetId.toLowerCase(), 'ascii').copy(tgtBuf, 0, 0, Math.min(targetId.length, srcBuf.length));

    let off = 0;
    while (off < result.length - srcBuf.length) {
      const i = result.indexOf(srcBuf, off);
      if (i === -1) break;
      tgtBuf.copy(result, i);
      off = i + srcBuf.length;
    }
  }

  return result;
}
