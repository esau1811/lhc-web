'use strict';
// server_awc_v2 — AWC rebuild from WAV+XML + inject + NG decrypt

const express         = require('express');
const multer          = require('multer');
const cors            = require('cors');
const fs              = require('fs');
const path            = require('path');
const os              = require('os');
const { exec, spawn } = require('child_process');
const crypto          = require('crypto');
const archiver        = require('archiver');

const app = express();
app.use(cors());
app.use(express.json());

const BASE_DIR      = '/var/www/lhc-node';
const CHUNKS_DIR    = path.join(BASE_DIR, 'chunks');
const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
const UPLOADS_DIR   = path.join(BASE_DIR, 'uploads');
const KEYS_DIR      = '/opt/lhc-keys';
const WAVS_DIR      = path.join(BASE_DIR, 'weapons_wavs');
const MANIFEST_PATH = path.join(BASE_DIR, 'weapons_manifest.json');
const OAC_TEMPLATE_DIR = path.join(BASE_DIR, 'weapons_oac_template');

[CHUNKS_DIR, TEMPLATES_DIR, UPLOADS_DIR, WAVS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

let AWC_MANIFEST = null;
function getManifest() {
    if (!AWC_MANIFEST && fs.existsSync(MANIFEST_PATH)) {
        AWC_MANIFEST = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    }
    return AWC_MANIFEST;
}

function joaat(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash += key.charCodeAt(i);
        hash += (hash << 10);
        hash ^= (hash >>> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >>> 11);
    hash += (hash << 15);
    return hash >>> 0;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });

const rpfStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => cb(null, `${Date.now()}_${(Math.random() * 9999) | 0}_${file.originalname}`)
});
const uploadRpf = multer({ storage: rpfStorage, limits: { fileSize: 600 * 1024 * 1024 } });

const WEAPON_FILES = {
    pistol:       'ptl_pistol.awc',
    combatpistol: 'ptl_combat.awc',
    smg:          'smg_smg.awc',
    microsmg:     'smg_micro.awc',
    killsound:    'resident.awc',
};

// ── Cargar claves GTA5 desde /opt/lhc-keys/ ─────────────────────────────────────
let GTA5_AES_KEY = null, GTA5_NG_KEYS = null, GTA5_NG_TABLES = null, GTA5_HASH_LUT = null;
function loadKeys() {
    try {
        const aesPath = path.join(KEYS_DIR, 'gtav_aes_key.dat');
        if (fs.existsSync(aesPath)) { GTA5_AES_KEY = fs.readFileSync(aesPath); console.log(`[keys] AES key: ${GTA5_AES_KEY.length}B`); }

        const lutPath = path.join(KEYS_DIR, 'gtav_hash_lut.dat');
        if (fs.existsSync(lutPath)) { GTA5_HASH_LUT = fs.readFileSync(lutPath); console.log(`[keys] Hash LUT: ${GTA5_HASH_LUT.length}B`); }

        const ngKeyPath = path.join(KEYS_DIR, 'gtav_ng_key.dat');
        if (fs.existsSync(ngKeyPath)) {
            const ngKeyRaw = fs.readFileSync(ngKeyPath);
            GTA5_NG_KEYS = [];
            for (let i = 0; i < 101; i++) GTA5_NG_KEYS.push(ngKeyRaw.slice(i * 272, (i + 1) * 272));
            console.log(`[keys] NG keys: ${GTA5_NG_KEYS.length}`);
        }

        // Formato magic.bin (CodeWalker/dnSpy): 17 rondas x 256 entradas x 1 byte = 4,352 bytes por tabla
        // Una "key" en NG usa 17 tablas de 256 bytes = 4,352 bytes por key
        const MAGIC_TABLE_SIZE = 17 * 256; // 4,352 bytes por tabla completa

        // Intentar cargar magic.bin primero (formato CodeWalker)
        const magicPath = path.join(KEYS_DIR, 'magic.bin');
        if (fs.existsSync(magicPath)) {
            const raw = fs.readFileSync(magicPath);
            GTA5_NG_TABLES = [];
            let off = 0;
            while (off + MAGIC_TABLE_SIZE <= raw.length) {
                const tableSet = [];
                for (let r = 0; r < 17; r++) {
                    const table = new Uint8Array(256);
                    for (let e = 0; e < 256; e++) table[e] = raw[off++];
                    tableSet.push(table);
                }
                GTA5_NG_TABLES.push(tableSet);
            }
            console.log(`[keys] magic.bin: ${GTA5_NG_TABLES.length} tablas NG cargadas (formato CodeWalker).`);
        }

        // Fallback: formato legacy Uint32 (gtav_ng_decrypt_tables.dat)
        if (!GTA5_NG_TABLES) {
            const SET_SIZE = 17 * 16 * 256 * 4;
            for (const tabName of ['gtav_ng_decrypt_tables.dat', 'gtav_ng_encrypt_luts.dat']) {
                const tabPath = path.join(KEYS_DIR, tabName);
                if (!fs.existsSync(tabPath)) continue;
                const ngTabRaw = fs.readFileSync(tabPath);
                GTA5_NG_TABLES = [];
                let off2 = ngTabRaw.length >= 0x600000 + SET_SIZE ? 0x600000 : 0;
                while (off2 + SET_SIZE <= ngTabRaw.length) {
                    const tableSet = [];
                    for (let r = 0; r < 17; r++) {
                        const table = new Uint8Array(256);
                        for (let e = 0; e < 256; e++) { table[e] = ngTabRaw[off2]; off2 += 4; }
                        tableSet.push(table);
                    }
                    GTA5_NG_TABLES.push(tableSet);
                }
                console.log(`[keys] ${tabName}: ${GTA5_NG_TABLES.length} tablas cargadas (formato legacy).`);
                break;
            }
        }
    } catch (e) { console.error('[keys] Error al cargar claves:', e.message); }
}
loadKeys();

// Hash interno de GTA5 (para índice de clave NG por archivo)
function gta5Hash(text) {
    if (!GTA5_HASH_LUT) return 0;
    let result = 0;
    for (let i = 0; i < text.length; i++) {
        const c = GTA5_HASH_LUT[text.charCodeAt(i) & 0xFF];
        result = ((Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 6 ^ Math.imul(1025, (c + result) >>> 0) >>> 0) >>> 0;
    }
    const r9 = Math.imul(9, result) >>> 0;
    return Math.imul(32769, ((r9 >>> 11) ^ r9) >>> 0) >>> 0;
}

// ── GTA5 NG block cipher (AES personalizado de Rockstar) ────────────────────────
// ── GTA5 NG block cipher (AES personalizado de Rockstar) ────────────────────────
// NG block cipher usando tablas Uint8 (formato CodeWalker magic.bin)
// Cada tableSet es un array de 17 tablas de 256 bytes.
// La "llave" es la propia tabla: XOR byte a byte con la key de 272 bytes.
function ngDecryptBlock(block, keyBuf, tableSet) {
    if (!tableSet || !keyBuf) return block;
    const out = Buffer.from(block.slice(0, 16));
    // Ronda por ronda: sustituir cada byte con su valor en la tabla, luego XOR con la subclave
    for (let round = 0; round < 17; round++) {
        const table = tableSet[round];
        const keyOff = round * 16;
        for (let b = 0; b < 16; b++) {
            out[b] = table[out[b]] ^ keyBuf[keyOff + b];
        }
    }
    return out;
}

function ngDecrypt(data, keyBuf, tableSet) {
    const out = Buffer.allocUnsafe(data.length);
    for (let i = 0; i < Math.floor(data.length / 16); i++) {
        const dec = ngDecryptBlock(data.slice(i*16, i*16+16), keyBuf, tableSet);
        dec.copy(out, i*16);
    }
    if (data.length % 16 !== 0) data.slice(Math.floor(data.length/16)*16).copy(out, Math.floor(data.length/16)*16);
    return out;
}

function getTableSet(filename) {
    if (!GTA5_NG_TABLES) return null;
    const hash = gta5Hash(filename);
    const index = hash % GTA5_NG_TABLES.length;
    return GTA5_NG_TABLES[index];
}

// ── Descifrado automático de AWC (AES o NG brute-force) ─────────────────────────
// weapons.awc de resident.rpf usa cifrado NG por archivo. Solo hay 101 claves
// posibles — probamos las 101 verificando si los primeros 16 bytes descifran a TADA.
function tryDecryptAWC(buf) {
    const magic4 = buf.slice(0, 4).toString('ascii');
    if (magic4 === 'TADA' || magic4 === 'ADAT') {
        console.log('[decrypt] Ya descifrado (TADA/ADAT).');
        return buf;
    }

    // Intento AES: probar todas las variantes con la key cargada + fallback hardcoded
    console.log('[decrypt] AES key cargada: ' + (GTA5_AES_KEY ? GTA5_AES_KEY.length + 'B ' + GTA5_AES_KEY.slice(0,4).toString('hex') : 'no cargada'));
    function tryAES(key, mode, label) {
        try {
            const out = Buffer.from(buf);
            for (let offset = 0; offset < buf.length; offset += 4096) {
                const blockLen = Math.min(4096, Math.floor((buf.length - offset) / 16) * 16);
                if (blockLen <= 0) break;
                const d = crypto.createDecipheriv(mode, key, null);
                d.setAutoPadding(false);
                Buffer.concat([d.update(buf.slice(offset, offset + blockLen)), d.final()]).copy(out, offset);
            }
            const m = out.slice(0, 4).toString('ascii');
            if (m === 'TADA' || m === 'ADAT' || m === 'RSNA') { console.log(`[decrypt] ${label} exitoso.`); return out; }
            console.log(`[decrypt] ${label} no produjo TADA/ADAT/RSNA, magic=${out.slice(0,4).toString('hex')}`);
        } catch (e) { console.log(`[decrypt] ${label} error: ${e.message}`); }
        return null;
    }

    // Key cargada desde /opt/lhc-keys/gtav_aes_key.dat
    if (GTA5_AES_KEY) {
        if (GTA5_AES_KEY.length === 32) {
            const r = tryAES(GTA5_AES_KEY, 'aes-256-ecb', 'AES-256-ECB (cargada)');
            if (r) return r;
        } else if (GTA5_AES_KEY.length === 16) {
            const r = tryAES(GTA5_AES_KEY, 'aes-128-ecb', 'AES-128-ECB (cargada)');
            if (r) return r;
        }
    }
    // Fallback: key hardcoded legacy
    {
        const r = tryAES(Buffer.from('4E7D7B5966F6943B4FA9F8C29B5671B3', 'hex'), 'aes-128-ecb', 'AES-128-ECB (legacy)');
        if (r) return r;
    }

    // Intento 2: NG con magic.bin — cada tabla es a la vez la tabla Y la llave (formato CodeWalker)
    // En el weapons.awc, la llave es la propia 'pc_awc_key': son 272 bytes de offset fijo en el magic.bin
    if (GTA5_NG_TABLES && GTA5_NG_TABLES.length > 0) {
        console.log(`[decrypt] Probando ${GTA5_NG_TABLES.length} tablas NG del magic.bin...`);
        for (let t = 0; t < GTA5_NG_TABLES.length; t++) {
            const tableSet = GTA5_NG_TABLES[t];
            // La key son los primeros 272 bytes de cada bloque de tabla en el magic.bin
            const keyBuf = Buffer.alloc(272);
            for (let r = 0; r < 17; r++) {
                for (let e = 0; e < 16; e++) keyBuf[r * 16 + e] = tableSet[r][e];
            }
            try {
                const first16 = ngDecryptBlock(buf.slice(0, 16), keyBuf, tableSet);
                const m = first16.slice(0, 4).toString('ascii');
                if (m === 'TADA' || m === 'ADAT' || m === 'RSNA') {
                    console.log(`[decrypt] ¡TABLA FUNCIONA! Magic: ${m}`);
                    return ngDecrypt(buf, keyBuf, tableSet);
                }
            } catch(e) {}
        }
        // También probar con las 101 llaves públicas si están cargadas
        if (GTA5_NG_KEYS) {
            console.log(`[decrypt] Probando 101 llaves públicas contra ${GTA5_NG_TABLES.length} tablas...`);
            for (let t = 0; t < GTA5_NG_TABLES.length; t++) {
                for (let i = 0; i < GTA5_NG_KEYS.length; i++) {
                    try {
                        const first16 = ngDecryptBlock(buf.slice(0, 16), GTA5_NG_KEYS[i], GTA5_NG_TABLES[t]);
                        const m = first16.slice(0, 4).toString('ascii');
                        if (m === 'TADA' || m === 'ADAT' || m === 'RSNA') {
                            console.log(`[decrypt] ENCONTRADO: llave válida`);
                            return ngDecrypt(buf, GTA5_NG_KEYS[i], GTA5_NG_TABLES[t]);
                        }
                    } catch(e) {}
                }
            }
        }
        console.log('[decrypt] Ninguna combinación NG funcionó.');
    }

    console.log(`[decrypt] Sin descifrar. Magic: ${buf.slice(0,8).toString('hex')}`);
    return buf;
}

// ── Jenkins One-At-A-Time hash con masking correcto ─────────────────────────────
function joaat(str) {
    let h = 0;
    str = (str || '').toLowerCase();
    for (let i = 0; i < str.length; i++) {
        h = (h + str.charCodeAt(i)) >>> 0;
        h = (h + (h << 10)) >>> 0;
        h = (h ^ (h >>> 6)) >>> 0;
    }
    h = (h + (h << 3)) >>> 0;
    h = (h ^ (h >>> 11)) >>> 0;
    h = (h + (h << 15)) >>> 0;
    return h;
}

// ── Streaming AWC patcher — búsqueda bruta del hash en todo el archivo ──────────
async function patchAWCStreaming(awcDataRaw, audioBuf, channelName, sampleRate) {
    const awcData = tryDecryptAWC(awcDataRaw);
    console.log(`[streaming] Búsqueda bruta en ${awcData.length} bytes...`);

    let targetHash = 0;
    const hexMatch = channelName.match(/hash_([0-9A-Fa-f]+)/i) || channelName.match(/^([0-9A-Fa-f]{8})$/i);
    if (hexMatch) {
        targetHash = parseInt(hexMatch[1], 16);
    } else {
        targetHash = joaat(channelName.toLowerCase());
    }
    console.log(`[streaming] Hash objetivo: 0x${targetHash.toString(16)} para "${channelName}"`);

    const hashLE = Buffer.alloc(4); hashLE.writeUInt32LE(targetHash, 0);
    const hashBE = Buffer.alloc(4); hashBE.writeUInt32BE(targetHash, 0);

    const hits = [];
    for (let i = 0; i <= awcData.length - 4; i++) {
        if (awcData[i] === hashLE[0] && awcData[i+1] === hashLE[1] &&
            awcData[i+2] === hashLE[2] && awcData[i+3] === hashLE[3]) {
            hits.push({ pos: i, endian: 'LE' });
        }
        if (awcData[i] === hashBE[0] && awcData[i+1] === hashBE[1] &&
            awcData[i+2] === hashBE[2] && awcData[i+3] === hashBE[3]) {
            hits.push({ pos: i, endian: 'BE' });
        }
    }

    console.log(`[streaming] Hits encontrados: ${hits.length}`);
    hits.slice(0, 5).forEach(h => {
        const ctx = awcData.slice(Math.max(0, h.pos-8), h.pos+24);
        console.log(`  pos=0x${h.pos.toString(16)} (${h.endian}) contexto: ${ctx.toString('hex')}`);
    });

    if (hits.length === 0)
        throw new Error(`Hash 0x${targetHash.toString(16)} de "${channelName}" no encontrado. ¿Nombre correcto?`);

    const hit = hits[0];
    const ctx = awcData.slice(Math.max(0, hit.pos - 16), hit.pos + 32);
    console.log(`[streaming] Contexto completo del hit: ${ctx.toString('hex')}`);

    let found = null;
    for (const relOff of [-8, -4, 4, 8, 12]) {
        const offPos = hit.pos + relOff;
        if (offPos < 0 || offPos + 8 > awcData.length) continue;
        const dataOff = awcData.readUInt32LE(offPos);
        const size    = awcData.readUInt32LE(offPos + 4) & 0xFFFFFF;
        if (dataOff > 1024 && dataOff < awcData.length && size > 4096 && size < awcData.length) {
            console.log(`[streaming] dataOff candidato: 0x${dataOff.toString(16)} size=${size} (relOff=${relOff})`);
            if (!found) found = { dataOff, size };
        }
    }

    if (!found)
        throw new Error(`Canal en 0x${hit.pos.toString(16)} pero no se pudo leer dataOff/size. Ctx: ${ctx.toString('hex')}`);

    console.log(`[streaming] Parcheando: dataOff=0x${found.dataOff.toString(16)} size=${found.size}`);
    const audio = await prepareAudio(audioBuf, sampleRate || '32000', 'pcm');
    const buf = Buffer.from(awcData);
    const written = Math.min(audio.length, found.size, buf.length - found.dataOff);
    audio.copy(buf, found.dataOff, 0, written);
    if (found.dataOff + written < found.dataOff + found.size)
        buf.fill(0, found.dataOff + written, Math.min(found.dataOff + found.size, buf.length));
    console.log(`[streaming] Escrito ${written}B en 0x${found.dataOff.toString(16)}`);
    return buf;
}

// ── AWC surgical patcher — reemplaza un canal por nombre/hash ───────────────────
async function patchAWCSurgical(awcDataRaw, audioBuf, channelName, sampleRate) {
    const awcData = tryDecryptAWC(awcDataRaw);
    console.log(`[surgical] header: ${awcData.slice(0, 8).toString('hex')}`);

    let tadaOff = awcData.indexOf(Buffer.from('ADAT'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('RSNA'));
    
    if (tadaOff === -1) {
        const maybeCount = awcData.readUInt16LE(0x08);
        if (maybeCount > 0 && maybeCount < 1024) {
            console.log(`[surgical] Sin magic válido, intentando offset 0 (maybeCount=${maybeCount})`);
            tadaOff = 0;
        } else {
            throw new Error(`No se detectó TADA/ADAT/RSNA. Primeros bytes: ${awcData.slice(0,8).toString('hex')}`);
        }
    }

    const b = Buffer.from(awcData.slice(tadaOff));
    const entryCountRaw = b.readUInt32LE(0x08);
    const entryCount = Math.min(entryCountRaw & 0xFFFF, 4096);

    // Probar variantes del nombre (con y sin extensión, punto → guión bajo)
    const nameVariants = [
        channelName.toLowerCase(),
        channelName.toLowerCase().replace(/\./g, '_'),
        channelName.toUpperCase()
    ];
    let targetHash = null;
    
    const hexMatch = channelName.match(/hash_([0-9A-Fa-f]+)/i) || channelName.match(/^([0-9A-Fa-f]{8})$/i);
    if (hexMatch) {
        targetHash = parseInt(hexMatch[1], 16);
    }

    let foundEntry = null;
    const targetHashes = new Set(nameVariants.map(joaat));

    console.log(`[surgical] magic=${b.slice(0,4).toString('ascii')} entries=${entryCount}`);
    console.log(`[surgical] hashes=[${[...targetHashes].map(h=>'0x'+h.toString(16)).join(',')}]`);
    for (let i = 0; i < Math.min(entryCount, 4); i++) {
        const off = 0x10 + i * 16;
        if (off + 16 > b.length) break;
        console.log(`  [e${i}] ${b.slice(off, off+16).toString('hex')}`);
    }

    // Buscar en Layout A (hash@+0) y Layout B (hash@+8)
    let found = null;
    for (let i = 0; i < entryCount; i++) {
        const off = 0x10 + i * 16;
        if (off + 16 > b.length) break;
        
        const w0 = b.readUInt32LE(off), w1 = b.readUInt32LE(off+4), w2 = b.readUInt32LE(off+8), codec = b[off+12];
        
        if (targetHash !== null) {
            if (w0 === targetHash) { found = { off, dataOff: w1, size: w2 & 0xFFFFFF, codec, layout: 'A' }; break; }
            if (w2 === targetHash) { found = { off, dataOff: w0, size: w1 & 0xFFFFFF, codec, layout: 'B' }; break; }
        }

        if (targetHashes.has(w0)) { found = { off, dataOff: w1, size: w2 & 0xFFFFFF, codec, layout: 'A' }; break; }
        if (targetHashes.has(w2)) { found = { off, dataOff: w0, size: w1 & 0xFFFFFF, codec, layout: 'B' }; break; }
    }

    if (!found)
        throw new Error(`Canal "${channelName}" no encontrado (${entryCount} entradas, layouts A+B). Verifica el nombre exacto.`);

    if (found.dataOff < 0x10 || found.dataOff >= b.length)
        throw new Error(`dataOff inválido: 0x${found.dataOff.toString(16)} (tamaño AWC: ${b.length})`);

    console.log(`[surgical] layout=${found.layout} dataOff=0x${found.dataOff.toString(16)} size=${found.size} codec=0x${found.codec.toString(16)}`);

    const format = found.codec === 0x06 ? 'adpcm' : 'pcm';
    const audio  = await prepareAudio(audioBuf, sampleRate || '32000', format);

    const buf = Buffer.from(b);
    const available = buf.length - found.dataOff;
    const written   = Math.min(audio.length, found.size, available);
    audio.copy(buf, found.dataOff, 0, written);
    const silenceEnd = Math.min(found.dataOff + found.size, buf.length);
    if (found.dataOff + written < silenceEnd) buf.fill(0, found.dataOff + written, silenceEnd);
    console.log(`[surgical] Escrito ${written}B en 0x${found.dataOff.toString(16)}`);

    const out = Buffer.alloc(tadaOff + buf.length);
    awcData.copy(out, 0, 0, tadaOff);
    buf.copy(out, tadaOff);
    return out;
}

// ── AWC multi-channel patcher (DLC weapons) ─────────────────────────────────────
function patchAWC(awcDataRaw, audioData) {
    const awcData = tryDecryptAWC(awcDataRaw);
    let tadaOff = awcData.indexOf(Buffer.from('ADAT'));
    if (tadaOff === -1) tadaOff = awcData.indexOf(Buffer.from('TADA'));
    if (tadaOff === -1) throw new Error('No se detectó cabecera TADA/ADAT.');

    const b = Buffer.from(awcData.slice(tadaOff));
    const candidates = [];
    for (let i = 0x10; i < Math.min(b.length, 0x1000); i++) {
        if (b[i] !== 0x55) continue;
        const tableOff  = i - 12;
        if (tableOff < 0x08) continue;
        const dataOff   = b.readUInt32LE(tableOff);
        const sizeFlags = b.readUInt32LE(tableOff + 4);
        const size      = sizeFlags & 0xFFFFFF;
        if (dataOff >= 0x10 && dataOff < b.length && size > 0)
            candidates.push({ tableOff, dataOff, size, flags: sizeFlags & 0xFF000000 });
    }

    if (candidates.length === 0) throw new Error('No se encontró canal de audio.');

    const headerEnd = Math.min(...candidates.map(c => c.dataOff));
    const sorted = candidates.filter(c => c.dataOff >= headerEnd).sort((a, b) => a.dataOff - b.dataOff);
    const allEntries = [];
    for (const c of sorted) {
        const prev = allEntries[allEntries.length - 1];
        if (!prev || c.dataOff >= prev.dataOff + prev.size) allEntries.push(c);
    }

    if (allEntries.length === 0) throw new Error('No se encontraron canales de audio.');
    const entries = allEntries.filter(e => e.size >= 4096);
    if (entries.length === 0) throw new Error('No se encontraron canales de audio principales.');

    console.log(`[inject] ${allEntries.length} entradas, ${entries.length} canales.`);

    const buf = Buffer.from(b);
    for (const e of entries) {
        const available = buf.length - e.dataOff;
        const written   = Math.min(audioData.length, e.size, available);
        audioData.copy(buf, e.dataOff, 0, written);
        const silenceEnd = Math.min(e.dataOff + e.size, buf.length);
        if (e.dataOff + written < silenceEnd) buf.fill(0, e.dataOff + written, silenceEnd);
    }

    const out = Buffer.alloc(tadaOff + buf.length);
    awcData.copy(out, 0, 0, tadaOff);
    buf.copy(out, tadaOff);
    return out;
}

// ── Audio converter via ffmpeg ───────────────────────────────────────────────────
function prepareAudio(audioBuf, sampleRate = '32000', format = 'pcm') {
    return new Promise((resolve, reject) => {
        const id   = `${Date.now()}_${(Math.random() * 9999) | 0}`;
        const inF  = path.join(os.tmpdir(), `ain_${id}`);
        const outF = path.join(os.tmpdir(), `aout_${id}.raw`);
        fs.writeFileSync(inF, audioBuf);

        if (format === 'adpcm') {
            const wavF = outF + '.wav';
            exec(`ffmpeg -y -i "${inF}" -acodec adpcm_ima_wav -ar ${sampleRate} -ac 1 "${wavF}"`, (err) => {
                try { fs.unlinkSync(inF); } catch {}
                if (err) return reject(new Error(`ffmpeg error: ${err.message}`));
                try {
                    const wav = fs.readFileSync(wavF);
                    try { fs.unlinkSync(wavF); } catch {}
                    const dataPos = wav.indexOf(Buffer.from('data'));
                    resolve(dataPos >= 0
                        ? wav.subarray(dataPos + 8, dataPos + 8 + wav.readUInt32LE(dataPos + 4))
                        : wav.subarray(44));
                } catch (e) { reject(e); }
            });
        } else {
            exec(`ffmpeg -y -i "${inF}" -f s16le -acodec pcm_s16le -ar ${sampleRate} -ac 1 "${outF}"`, (err) => {
                try { fs.unlinkSync(inF); } catch {}
                if (err) return reject(new Error(`ffmpeg error: ${err.message}`));
                try {
                    const raw = fs.readFileSync(outF);
                    try { fs.unlinkSync(outF); } catch {}
                    resolve(raw);
                } catch (e) { reject(e); }
            });
        }
    });
}

// ── ENDPOINTS ────────────────────────────────────────────────────────────────────

// 1. Recibir chunks del archivo AWC grande
app.post('/api/Sound/upload-chunk', upload.single('chunk'), (req, res) => {
    const { uploadId, index, total } = req.body;
    if (!uploadId || index == null) return res.status(400).json({ error: 'Faltan uploadId/index' });
    fs.writeFileSync(path.join(CHUNKS_DIR, `${uploadId}_${index}`), req.file.buffer);
    console.log(`[chunk] ${uploadId} ${index}/${total}`);
    res.json({ status: 'ok' });
});

// 2. Ensamblar y procesar AWC
app.post('/api/Sound/assemble-and-inject', upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'awc',   maxCount: 1 }
]), async (req, res) => {
    try {
        const { uploadId, total, useTemplate, weaponType, sampleRate, format, surgicalName } = req.body;
        const audioFile = req.files['audio'] ? req.files['audio'][0] : null;
        const awcFile   = req.files['awc']   ? req.files['awc'][0]   : null;

        if (!audioFile) return res.status(400).json({ error: 'Falta el archivo de audio' });

        let awcBuf;
        if (useTemplate === 'true') {
            const tPath = path.join(TEMPLATES_DIR, `${weaponType}.awc`);
            if (fs.existsSync(tPath)) {
                awcBuf = fs.readFileSync(tPath);
            } else {
                if (!awcFile) return res.status(400).json({ error: `Plantilla ${weaponType} no encontrada.` });
                awcBuf = awcFile.buffer;
                fs.writeFileSync(tPath, awcBuf);
            }
        } else if (awcFile) {
            awcBuf = awcFile.buffer;
        } else {
            const n = parseInt(total, 10);
            if (!n || n <= 0) return res.status(400).json({ error: 'Total de chunks inválido' });
            const parts = [];
            for (let i = 0; i < n; i++) {
                const cp = path.join(CHUNKS_DIR, `${uploadId}_${i}`);
                if (!fs.existsSync(cp)) return res.status(400).json({ error: `Chunk ${i} no encontrado` });
                parts.push(fs.readFileSync(cp));
            }
            awcBuf = Buffer.concat(parts);
            for (let i = 0; i < n; i++) try { fs.unlinkSync(path.join(CHUNKS_DIR, `${uploadId}_${i}`)); } catch {}
        }

        let patched, outName;
        if (surgicalName) {
            console.log(`[inject] surgical="${surgicalName}" awcBuf=${awcBuf.length}B via=${awcFile?'direct':'chunks'}`);
            console.log(`[inject] awcBuf[0..15]: ${awcBuf.slice(0,16).toString('hex')}`);
            try { fs.writeFileSync('/tmp/debug_awc.bin', awcBuf); } catch {}
            try {
                patched = await patchAWCSurgical(awcBuf, audioFile.buffer, surgicalName, sampleRate || '32000');
            } catch (e1) {
                console.log(`[inject] surgical falló: ${e1.message.slice(0,120)}. Probando streaming brute-force...`);
                patched = await patchAWCStreaming(awcBuf, audioFile.buffer, surgicalName, sampleRate || '32000');
            }
            outName = awcFile ? awcFile.originalname : 'patched.awc';
        } else {
            const audio = await prepareAudio(audioFile.buffer, sampleRate || '32000', format || 'pcm');
            console.log(`[inject] weapon=${weaponType} audio=${audio.length}B`);
            patched = patchAWC(awcBuf, audio);
            outName = WEAPON_FILES[weaponType] || `${weaponType || 'patched'}.awc`;
        }

        const zip = new AdmZip();
        zip.addFile(outName, patched);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="LHC_Sound_${weaponType || 'sound'}.zip"`);
        res.send(zip.toBuffer());

    } catch (err) {
        console.error('[inject] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Firmar archivo .RPF con ArchiveFix (disk storage)
app.post('/api/Sound/fix-rpf', uploadRpf.single('rpf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se ha subido ningún archivo .RPF' });

    const tempDir = path.join(UPLOADS_DIR, `rpf_${Date.now()}_${(Math.random() * 9999) | 0}`);
    const rpfPath = path.join(tempDir, req.file.originalname);
    const cleanup = () => { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} };

    try {
        fs.mkdirSync(tempDir);
        fs.renameSync(req.file.path, rpfPath);
        console.log(`[fix-rpf] Procesando: ${req.file.originalname} (${req.file.size} bytes)`);

        const child = spawn('wine', ['ArchiveFix.exe', rpfPath], { cwd: BASE_DIR });
        let stderr = '';
        child.stderr.on('data', d => { stderr += d.toString(); });
        child.on('close', code => {
            if (code !== 0) {
                console.error('[fix-rpf] ArchiveFix error:', stderr);
                cleanup();
                return res.status(500).json({ error: 'Error al firmar el RPF.' });
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname}"`);
            const stream = fs.createReadStream(rpfPath);
            stream.pipe(res);
            const done = () => cleanup();
            res.on('finish', done); res.on('close', done);
        });
        child.on('error', err => {
            console.error('[fix-rpf] spawn error:', err.message);
            cleanup();
            if (!res.headersSent) res.status(500).json({ error: err.message });
        });
    } catch (err) {
        console.error('[fix-rpf] Error:', err.message);
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// 4. Guardar plantilla AWC
app.post('/api/Sound/upload-template', upload.single('awc'), (req, res) => {
    const { weaponType } = req.body;
    if (!weaponType || !req.file) return res.status(400).json({ error: 'Faltan weaponType o archivo' });
    const dest = path.join(TEMPLATES_DIR, `${weaponType}.awc`);
    fs.writeFileSync(dest, req.file.buffer);
    console.log(`[template] ${weaponType} guardado (${req.file.buffer.length} bytes)`);
    res.json({ status: 'ok', file: dest });
});

// 5. Parchear resident.rpf — USA RPF-CLI (MOTOR RUST) PARA MÁXIMA COMPATIBILIDAD
app.post('/api/Sound/patch-resident', uploadRpf.fields([
    { name: 'rpf',   maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), async (req, res) => {
    const rpfFile   = req.files['rpf']   ? req.files['rpf'][0]   : null;
    const audioFile = req.files['audio'] ? req.files['audio'][0] : null;
    const { channelName, sampleRate } = req.body;

    if (!rpfFile || !audioFile || !channelName)
        return res.status(400).json({ error: 'Faltan rpf, audio o channelName' });

    const tempDir = path.join(UPLOADS_DIR, 'resident_' + Date.now());
    const rpfPath = path.join(tempDir, rpfFile.originalname);
    const extractDir = path.join(tempDir, 'extracted');
    const cleanup = () => { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} };

    try {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.mkdirSync(extractDir, { recursive: true });
        fs.renameSync(rpfFile.path, rpfPath);

        // Detectar si el archivo subido es AWC directo o RPF
        const rpfMagic = fs.readFileSync(rpfPath).slice(0, 4);
        const isDirectAWC = rpfFile.originalname.toLowerCase().endsWith('.awc') ||
                            (rpfMagic[0] !== 0x52 || rpfMagic[1] !== 0x50 || rpfMagic[2] !== 0x46); // no empieza con "RPF"

        let awcBuf;

        if (isDirectAWC) {
            console.log(`[resident] Archivo AWC directo detectado: ${rpfFile.originalname}`);
            awcBuf = fs.readFileSync(rpfPath);
        } else {
            console.log(`[resident] RPF: ${rpfFile.originalname} (Procesando con ArchiveFix...)`);

            // PASO 1: Copiar ArchiveFix y llaves a la carpeta temporal
            const archExe = path.join(BASE_DIR, 'ArchiveFix.exe');
            fs.copyFileSync(archExe, path.join(tempDir, 'ArchiveFix.exe'));
            const allKeys = fs.readdirSync(BASE_DIR).filter(f => f.endsWith('.dat'));
            allKeys.forEach(k => fs.copyFileSync(path.join(BASE_DIR, k), path.join(tempDir, k)));

            await new Promise((resolve, reject) => {
                console.log('[resident] Ejecutando ArchiveFix localmente en tempDir...');
                const child = spawn('wine', ['ArchiveFix.exe', 'fix', rpfFile.originalname], { cwd: tempDir });
                let output = '';
                child.stdout.on('data', d => output += d);
                child.stderr.on('data', d => output += d);
                child.on('close', code => {
                    console.log(`[resident] ArchiveFix finalizado (code ${code})`);
                    if (code !== 0 || output.includes('Failed')) {
                        console.error('[resident] ArchiveFix falló:', output.replace(/[^\x20-\x7e\n]/g, '.'));
                        return reject(new Error('ArchiveFix falló. Comprueba que el RPF sea válido y las keys correctas.'));
                    }
                    resolve();
                });
                child.on('error', err => reject(new Error('Wine no pudo iniciar ArchiveFix: ' + err.message)));
            });

            // PASO 2: Extraer con rpf-cli
            const rpfBin = '/root/rpf-cli/target/release/rpf';
            const cmd = `"${rpfBin}" extract "${rpfFile.originalname}" -o "extracted" --keys "."`;
            console.log(`[resident] Ejecutando extracción Rust en tempDir...`);
            await new Promise((resolve, reject) => {
                exec(cmd, { cwd: tempDir }, (err, stdout, stderr) => {
                    if (err) {
                        console.error('[resident] rpf-cli error:', stderr);
                        return reject(new Error('Fallo al extraer RPF: ' + stderr.slice(0,100)));
                    }
                    resolve();
                });
            });

            function findAWC(dir) {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const p = path.join(dir, f);
                    if (fs.statSync(p).isDirectory()) { const r = findAWC(p); if (r) return r; }
                    else if (f.toLowerCase() === 'weapons.awc') return p;
                }
                return null;
            }
            const awcPathFound = findAWC(extractDir);
            if (!awcPathFound) {
                const allFiles = fs.readdirSync(extractDir);
                throw new Error(`No se encontró weapons.awc en el Resident. Archivos: ${allFiles.slice(0,5).join(', ')}`);
            }
            console.log(`[resident] AWC encontrado en: ${awcPathFound}`);
            awcBuf = fs.readFileSync(awcPathFound);
        }
        const audioBuf = fs.readFileSync(audioFile.path);

        let patched;
        try {
            // Intentar primero el parche quirúrgico estándar
            patched = await patchAWCSurgical(awcBuf, audioBuf, channelName, sampleRate || '32000');
        } catch (e1) {
            console.log(`[resident] surgical falló (${e1.message.slice(0,50)}). Intentando streaming brute-force...`);
            patched = await patchAWCStreaming(awcBuf, audioBuf, channelName, sampleRate || '32000');
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="weapons_patched.awc"`);
        res.send(patched);
        console.log(`[resident] ÉXITO: Devuelto AWC parcheado (${patched.length} bytes)`);

    } catch (err) {
        console.error('[resident] Error Fatal:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    } finally {
        setTimeout(cleanup, 60000); // 1 minuto de margen para limpieza
    }
});

// ── 6. GET /api/Sound/manifest — Lista todos los sonidos disponibles ──────────
// Devuelve { entries: [ { name, fileName, sampleRate, channels }, ... ] }
// El frontend lo usa para mostrar el dropdown de sonidos al usuario.
app.get('/api/Sound/manifest', (req, res) => {
    console.log(`[api] Manifest request from ${req.ip}`);
    const manifest = getManifest();
    if (!manifest) {
        console.error('[api] Manifest file missing or invalid');
        return res.status(503).json({ error: 'XML no cargado aún.' });
    }
    const entries = Object.entries(manifest).map(([name, meta]) => ({
        name, ...meta
    }));
    console.log(`[api] Returning ${entries.length} entries`);
    res.json({ total: entries.length, entries });
});

// ── 7. POST /api/Sound/upload-wavs — Admin: sube JSON + carpeta WAVs ──────────
// Recibe:  json (archivo), wavs (múltiples archivos .wav)
const uploadWavs = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if (file.fieldname === 'json') cb(null, BASE_DIR);
            else cb(null, WAVS_DIR);
        },
        filename: (req, file, cb) => {
            if (file.fieldname === 'json') cb(null, 'weapons_manifest.json');
            else cb(null, file.originalname);
        }
    }),
    limits: { fileSize: 600 * 1024 * 1024 }
});

app.post('/api/Sound/upload-wavs',
    uploadWavs.fields([{ name: 'json', maxCount: 1 }, { name: 'wavs', maxCount: 1000 }]),
    (req, res) => {
        const jsonFile = req.files['json'];
        const wavFiles = req.files['wavs'] || [];
        if (!jsonFile) return res.status(400).json({ error: 'Falta el JSON manifest' });
        // Recargar manifiesto
        AWC_MANIFEST = null;
        const manifest = getManifest();
        console.log(`[upload-wavs] JSON guardado. WAVs subidos: ${wavFiles.length}. Manifest: ${Object.keys(manifest).length} entradas.`);
        res.json({ ok: true, entries: Object.keys(manifest).length, wavsUploaded: wavFiles.length });
    }
);

// ── 8. POST /api/Sound/rebuild-awc — Reconstruye weapons.oac (ZIP) ─
app.post('/api/Sound/rebuild-awc', upload.fields([{ name: 'audios', maxCount: 50 }, { name: 'awcBase', maxCount: 1 }]), async (req, res) => {
    try {
        const { soundNames } = req.body;
        const audioFiles = req.files['audios'];

        if (!audioFiles || audioFiles.length === 0) return res.status(400).json({ error: 'Faltan los archivos de audio' });
        if (!soundNames) return res.status(400).json({ error: 'Falta soundNames' });

        const parsedNames = JSON.parse(soundNames);
        if (audioFiles.length !== parsedNames.length) return res.status(400).json({ error: 'Incongruencia entre audios y nombres' });

        if (!fs.existsSync(OAC_TEMPLATE_DIR)) {
            return res.status(500).json({ error: 'El servidor no tiene el template OAC configurado.' });
        }

        const sessionId = crypto.randomBytes(8).toString('hex');
        const sessionDir = path.join(os.tmpdir(), `oac_session_${sessionId}`);
        fs.mkdirSync(sessionDir);
        
        const templateWeaponsDir = path.join(OAC_TEMPLATE_DIR, 'weapons');
        const sessionWeaponsDir = path.join(sessionDir, 'weapons');
        fs.mkdirSync(sessionWeaponsDir);
        
        // Copiar el weapons.oac
        fs.copyFileSync(path.join(OAC_TEMPLATE_DIR, 'weapons.oac'), path.join(sessionDir, 'weapons.oac'));
        
        // Copiar todos los wavs del template
        const templateFiles = fs.readdirSync(templateWeaponsDir);
        const nameMap = {};
        for (const tf of templateFiles) {
            fs.copyFileSync(path.join(templateWeaponsDir, tf), path.join(sessionWeaponsDir, tf));
            const base = tf.replace('.wav', '').toLowerCase();
            nameMap[base] = tf;
            nameMap[joaat(base).toString(16).padStart(8, '0').toLowerCase()] = tf;
            const match = base.match(/^(?:0x)?([0-9a-f]{8})$/);
            if (match) {
                nameMap[`hash_${match[1]}`] = tf;
                nameMap[match[1]] = tf;
            }
        }

        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];
            const soundName = parsedNames[i].toLowerCase();
            
            let outName = nameMap[soundName];
            if (!outName) {
                outName = `${soundName}.wav`; // Fallback
            }

            const inTmp = path.join(sessionDir, `in_${i}.tmp`);
            const outWav = path.join(sessionWeaponsDir, outName);
            
            fs.writeFileSync(inTmp, file.buffer);
            
            await new Promise((resolve, reject) => {
                const cmd = `ffmpeg -y -i "${inTmp}" -ar 32000 -ac 1 -c:a pcm_s16le "${outWav}"`;
                exec(cmd, (err) => {
                    try { fs.unlinkSync(inTmp); } catch(e){}
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        // Generar archivo OAC siguiendo exactamente la estructura de wea.txt
        let oacContent = `Version 1 11\n{\n\tIsStream False\n\tDescriptorsInOrder False\n\tEntries\n\t{\n`;
        const manifest = getManifest();
        if (!manifest) throw new Error("No hay manifest cargado para reconstruir el AWC");
        
        const allTrackNames = Object.keys(manifest);
        for (const trackName of allTrackNames) {
            // wea.txt usa el nombre directamente en WaveTrack, no el hash
            oacContent += `\t\tWaveTrack ${trackName}\n`;
            oacContent += `\t\t{\n`;
            oacContent += `\t\t\tCompression PCM\n`;
            oacContent += `\t\t\tHeadroom -100\n`; // Valor por defecto seguro
            oacContent += `\t\t\tLoopPoint -1\n`;
            oacContent += `\t\t\tLoopBegin 0\n`;
            oacContent += `\t\t\tLoopEnd 0\n`;
            oacContent += `\t\t\tPlayBegin 0\n`;
            oacContent += `\t\t\tPlayEnd 0\n`;
            oacContent += `\t\t\tWave weapons\\${trackName}.wav\n`; // Backslash como en el ejemplo
            oacContent += `\t\t\tAnimClip null\n`;
            oacContent += `\t\t\tEvents null\n`;
            oacContent += `\t\t\tUNKNOWN_23097A2B null\n`;
            oacContent += `\t\t\tUNKNOWN_E787895A null\n`;
            oacContent += `\t\t\tUNKNOWN_252C20D9 null\n`;
            oacContent += `\t\t}\n`;
        }
        oacContent += `\t}\n}\n`;


        
        const zipPath = path.join(os.tmpdir(), `weapons_oac_${sessionId}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 1 } }); // Compresión baja para velocidad
        
        output.on('close', () => {
            res.download(zipPath, 'weapons_oac.zip', (err) => {
                try {
                    fs.unlinkSync(zipPath);
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                } catch(e) { console.error('Error cleanup:', e); }
            });
        });

        archive.on('error', (err) => { throw err; });
        archive.pipe(output);

        // 1. Añadir el .oac
        archive.append(oacContent, { name: 'weapons.oac' });

        // 2. Añadir la carpeta weapons/ con TODOS los wavs
        const replacedSet = new Set(parsedNames.map(n => n.toLowerCase()));
        
        for (const trackName of allTrackNames) {
            const lowName = trackName.toLowerCase();
            const wavInZip = `weapons/${trackName}.wav`;
            
            if (replacedSet.has(lowName)) {
                // Usar el archivo convertido por FFmpeg en la carpeta de sesión
                const convertedPath = path.join(sessionWeaponsDir, `${trackName}.wav`);
                if (fs.existsSync(convertedPath)) {
                    archive.file(convertedPath, { name: wavInZip });
                } else {
                    // Fallback al original si algo falló en FFmpeg
                    archive.file(path.join(WAVS_DIR, `${trackName}.wav`), { name: wavInZip });
                }
            } else {
                // Usar el original
                archive.file(path.join(WAVS_DIR, `${trackName}.wav`), { name: wavInZip });
            }
        }

        archive.finalize();

    } catch (err) {
        console.error('[rebuild] Error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => res.json({ version: 'server_awc_v2-oac', status: 'ok' }));

app.listen(5000, '0.0.0.0', () => console.log('[server_awc_v2] Listo en puerto 5000'));
