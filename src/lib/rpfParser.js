/**
 * RPF File Parser
 * Parses Rockstar RPF (Resource Package Format) archives in memory (Buffer).
 * Extracts internal file listing to detect weapon types.
 *
 * RPF7 Format (GTA V):
 * - Magic: 0x52504637 ("RPF7") at offset 0
 * - Header contains entry count and names offset
 * - Entries follow the header (16 bytes each)
 * - Filenames are stored in a names section at the end
 */

// RPF7 Magic Number: "RPF7" = 0x52 0x50 0x46 0x37
const RPF7_MAGIC = 0x52504637;
// RPF2 Magic for older formats
const RPF2_MAGIC = 0x52504632;
// RPF0
const RPF0_MAGIC = 0x52504630;

/**
 * Validate that a buffer is a legitimate RPF file from Rockstar Games
 * by checking the magic number header.
 */
export function validateRPF(buffer) {
  // buffer should be an ArrayBuffer or Uint8Array
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  
  if (!u8 || u8.length < 4) {
    return { valid: false, error: 'File too small to be a valid RPF archive' };
  }

  // Get BE uint32
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = view.getUint32(0, false); // false = big endian

  if (magic === RPF7_MAGIC) {
    return { valid: true, version: 7 };
  }
  if (magic === RPF2_MAGIC) {
    return { valid: true, version: 2 };
  }
  if (magic === RPF0_MAGIC) {
    return { valid: true, version: 0 };
  }

  // Also check for the string "RPF" at start
  const magicStr = String.fromCharCode(u8[0], u8[1], u8[2]);
  if (magicStr === 'RPF') {
    const version = parseInt(String.fromCharCode(u8[3]), 10);
    return { valid: true, version: isNaN(version) ? -1 : version };
  }

  return { valid: false, error: 'Invalid file: not a Rockstar RPF archive (bad magic number)' };
}

/**
 * Extract filenames from an RPF buffer.
 * Scans for readable ASCII strings that look like GTA V asset filenames (.ytd, .ydr, .yft, etc.)
 *
 * Since RPF7 files are often encrypted/compressed, we scan the raw buffer
 * for known patterns and filename extensions.
 */
export function extractFilenames(buffer) {
  const filenames = new Set();
  
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Method 1: Scan for null-terminated ASCII strings that match weapon/asset patterns
  const extensions = ['.ytd', '.ydr', '.yft', '.ydd', '.ycd', '.xml', '.meta', '.dat'];
  const weaponPrefixes = ['w_pi_', 'w_sb_', 'w_ar_', 'w_sg_', 'w_mg_', 'w_sr_', 'w_lr_', 'w_me_', 'w_ex_'];

  let currentStr = '';
  // Check up to first 2MB where TOC is usually located to avoid freezing browser on 50MB files
  const maxSearch = Math.min(u8.length, 2 * 1024 * 1024);
  
  for (let i = 0; i < maxSearch; i++) {
    const byte = u8[i];
    // Printable ASCII range
    if (byte >= 0x20 && byte <= 0x7E) {
      currentStr += String.fromCharCode(byte);
    } else {
      if (currentStr.length >= 4) {
        const lower = currentStr.toLowerCase();
        // Check for weapon-related filenames
        for (const prefix of weaponPrefixes) {
          if (lower.includes(prefix)) {
            filenames.add(currentStr.trim());
            break;
          }
        }
        // Check for known extensions
        for (const ext of extensions) {
          if (lower.endsWith(ext)) {
            filenames.add(currentStr.trim());
            break;
          }
        }
      }
      currentStr = '';
    }
  }

  // Check last accumulated string
  if (currentStr.length >= 4) {
    const lower = currentStr.toLowerCase();
    for (const prefix of weaponPrefixes) {
      if (lower.includes(prefix)) {
        filenames.add(currentStr.trim());
      }
    }
  }

  return Array.from(filenames);
}

/**
 * Scan for weapon-related entries in the filename
 * (e.g., the RPF filename itself can contain weapon identifiers)
 */
export function extractFromFilename(filename) {
  if (!filename) return [];
  return [filename.replace('.rpf', '')];
}
