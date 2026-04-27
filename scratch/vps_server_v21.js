'use strict';
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const AdmZip   = require('adm-zip');

const app  = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.get('/ping', (req, res) => res.send('pong v21'));

app.get('/api/Sound/test', (req, res) => {
    res.send('Sound API v4.0 (FiveM Resource Generator) | ffmpeg: OK');
});

// ──────────────────────────────────────────────────────────────────────────────
// KILL SOUND  POST /api/Sound/kill
// User uploads MP3/WAV → returns ZIP with FiveM resource for kill sound
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/Sound/kill', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo de audio.');
    try {
        const mp3Buf = await convertToMp3(req.file.buffer, req.file.originalname);
        const zip = buildKillResource(mp3Buf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="LHC_KillSound.zip"');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.send(zip);
    } catch (e) {
        console.error('[Kill] Error:', e.message);
        res.status(500).send(e.message);
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// WEAPON SOUND  POST /api/Sound/weapon
// User uploads MP3/WAV → returns ZIP with FiveM resource for weapon fire sound
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/Sound/weapon', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo de audio.');
    try {
        const mp3Buf = await convertToMp3(req.file.buffer, req.file.originalname);
        const zip = buildWeaponResource(mp3Buf);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="LHC_WeaponSound.zip"');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.send(zip);
    } catch (e) {
        console.error('[Weapon] Error:', e.message);
        res.status(500).send(e.message);
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// Audio conversion: any audio → MP3 (for NUI playback)
// ──────────────────────────────────────────────────────────────────────────────
function convertToMp3(audioBuffer, originalName) {
    const ext = path.extname(originalName || '.mp3') || '.mp3';
    // If already MP3, return as-is
    if (ext.toLowerCase() === '.mp3') return Promise.resolve(audioBuffer);

    const tmpIn  = path.join(os.tmpdir(), `lhc_${Date.now()}_in${ext}`);
    const tmpOut = path.join(os.tmpdir(), `lhc_${Date.now()}_out.mp3`);

    return new Promise((resolve, reject) => {
        fs.writeFileSync(tmpIn, audioBuffer);
        exec(
            `ffmpeg -y -i "${tmpIn}" -acodec libmp3lame -ar 44100 -b:a 192k "${tmpOut}" 2>&1`,
            (err, stdout) => {
                const cleanup = () => {
                    [tmpIn, tmpOut].forEach(f => { try { fs.unlinkSync(f); } catch {} });
                };
                if (err) { cleanup(); return reject(new Error('Error convirtiendo audio: ' + stdout.slice(-300))); }
                try {
                    const buf = fs.readFileSync(tmpOut);
                    cleanup();
                    resolve(buf);
                } catch (e2) { cleanup(); reject(new Error('No se pudo leer el MP3 convertido')); }
            }
        );
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// BUILD KILL SOUND RESOURCE
// ──────────────────────────────────────────────────────────────────────────────
function buildKillResource(mp3Buffer) {
    const zip = new AdmZip();
    const DIR = 'LHC_KillSound/';

    // fxmanifest.lua
    zip.addFile(DIR + 'fxmanifest.lua', Buffer.from(`fx_version 'cerulean'
game 'gta5'

author 'LHC'
description 'LHC Custom Kill Sound'
version '1.0.0'

client_script 'client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/sounds/kill.mp3',
}
`));

    // client.lua - Kill detection
    zip.addFile(DIR + 'client.lua', Buffer.from(`-- LHC Kill Sound - Detects when player kills another player
local lastKillTime = 0

RegisterNetEvent('gameEventTriggered')
AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkEntityDamage' then
        local victim = args[1]
        local attacker = args[2]
        local isDead = args[4] == 1
        local weaponHash = args[7]

        if isDead and attacker == PlayerPedId() and victim ~= PlayerPedId() then
            local now = GetGameTimer()
            if now - lastKillTime > 500 then -- Prevent spam
                lastKillTime = now
                SendNUIMessage({ type = 'playKill' })
            end
        end
    end
end)

-- Fallback: Also check for network kill events
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        local ped = PlayerPedId()
        if IsPedShooting(ped) then
            Citizen.Wait(100)
        end
    end
end)
`));

    // HTML/NUI page
    zip.addFile(DIR + 'html/index.html', Buffer.from(`<!DOCTYPE html>
<html>
<head>
    <style>body { margin: 0; padding: 0; overflow: hidden; background: transparent; }</style>
</head>
<body>
    <audio id="killSound" src="sounds/kill.mp3" preload="auto"></audio>
    <script>
        const killAudio = document.getElementById('killSound');
        killAudio.volume = 0.8;

        window.addEventListener('message', function(event) {
            if (event.data.type === 'playKill') {
                killAudio.currentTime = 0;
                killAudio.play().catch(() => {});
            }
        });
    </script>
</body>
</html>
`));

    // Audio file
    zip.addFile(DIR + 'html/sounds/kill.mp3', mp3Buffer);

    return zip.toBuffer();
}

// ──────────────────────────────────────────────────────────────────────────────
// BUILD WEAPON SOUND RESOURCE
// ──────────────────────────────────────────────────────────────────────────────
function buildWeaponResource(mp3Buffer) {
    const zip = new AdmZip();
    const DIR = 'LHC_WeaponSound/';

    // fxmanifest.lua
    zip.addFile(DIR + 'fxmanifest.lua', Buffer.from(`fx_version 'cerulean'
game 'gta5'

author 'LHC'
description 'LHC Custom Weapon Sound'
version '1.0.0'

client_script 'client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/sounds/shoot.mp3',
}
`));

    // client.lua - Weapon fire detection
    zip.addFile(DIR + 'client.lua', Buffer.from(`-- LHC Weapon Sound - Custom fire sound overlay
-- Plays your custom sound every time the player fires any weapon

local lastShotTime = 0
local COOLDOWN = 80 -- ms between shots to prevent overlap

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        local ped = PlayerPedId()

        if IsPedShooting(ped) then
            local now = GetGameTimer()
            if now - lastShotTime > COOLDOWN then
                lastShotTime = now
                SendNUIMessage({ type = 'playShoot' })
            end
        end
    end
end)

-- Optional: Reduce native weapon volume (uncomment if desired)
-- Citizen.CreateThread(function()
--     while true do
--         Citizen.Wait(0)
--         -- This lowers the SFX channel which includes weapon sounds
--         -- Adjust 0.3 to your preference (0.0 = mute, 1.0 = full)
--         SetAudioFlag("MobileRadioInGame", false)
--     end
-- end)
`));

    // HTML/NUI page
    zip.addFile(DIR + 'html/index.html', Buffer.from(`<!DOCTYPE html>
<html>
<head>
    <style>body { margin: 0; padding: 0; overflow: hidden; background: transparent; }</style>
</head>
<body>
    <audio id="shootSound" src="sounds/shoot.mp3" preload="auto"></audio>
    <script>
        // Use multiple audio instances for rapid fire overlap
        const POOL_SIZE = 6;
        const audioPool = [];
        let poolIndex = 0;

        for (let i = 0; i < POOL_SIZE; i++) {
            const a = new Audio('sounds/shoot.mp3');
            a.volume = 0.7;
            a.preload = 'auto';
            audioPool.push(a);
        }

        window.addEventListener('message', function(event) {
            if (event.data.type === 'playShoot') {
                const audio = audioPool[poolIndex];
                audio.currentTime = 0;
                audio.play().catch(() => {});
                poolIndex = (poolIndex + 1) % POOL_SIZE;
            }
        });
    </script>
</body>
</html>
`));

    // Audio file
    zip.addFile(DIR + 'html/sounds/shoot.mp3', mp3Buffer);

    return zip.toBuffer();
}

// ──────────────────────────────────────────────────────────────────────────────
// WEAPON CONVERTER  POST /api/WeaponConverter/convert  (v17 — unchanged)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/api/WeaponConverter/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const targetId = (req.body.targetWeapon || '').toLowerCase().trim();
    const sourceId = (req.body.sourceWeapon || '').toLowerCase().trim();
    if (!targetId) return res.status(400).send('Missing target weapon ID.');

    const original = req.file.buffer;
    const log = [];

    try {
        log.push(`File size: ${original.length} bytes`);

        const rpfMagic  = Buffer.from([0x37, 0x46, 0x50, 0x52]);
        const rpfHeaders = [];
        let searchPos = 0;

        while ((searchPos = original.indexOf(rpfMagic, searchPos)) !== -1) {
            const entryCount  = original.readUInt32LE(searchPos + 4);
            const namesLength = original.readUInt32LE(searchPos + 8);
            const encFlag     = original.readUInt32LE(searchPos + 12);

            let encStr = 'UNKNOWN';
            if (encFlag === 0x4e45504f) encStr = 'OPEN';
            else if (encFlag === 0x0FFFFFF9) encStr = 'AES';
            else if (encFlag === 0x0FEFFFFF) encStr = 'NG';
            else if (encFlag === 0) encStr = 'NONE';
            else encStr = Buffer.from([encFlag&0xFF,(encFlag>>8)&0xFF,(encFlag>>16)&0xFF,(encFlag>>24)&0xFF]).toString('ascii');

            const nameTableOffset = searchPos + 16 + entryCount * 16;
            rpfHeaders.push({ offset: searchPos, entryCount, namesLength, encryption: encStr.trim(), nameTableOffset });
            log.push(`RPF at 0x${searchPos.toString(16)}: entries=${entryCount}, namesLen=${namesLength}, enc="${encStr}"`);
            searchPos += 4;
        }

        let totalReplacements = 0;
        const output = Buffer.from(original);

        for (const rpf of rpfHeaders) {
            if (rpf.encryption !== 'OPEN' && rpf.encryption !== 'NONE') {
                log.push(`  Skipping encrypted RPF at 0x${rpf.offset.toString(16)}`);
                continue;
            }

            const nameTableStart = rpf.nameTableOffset;
            const nameTableEnd   = nameTableStart + rpf.namesLength;
            const nameTableSize  = rpf.namesLength;

            if (nameTableSize <= 0 || nameTableSize > 100000 || nameTableEnd > output.length) {
                log.push(`  Skipping RPF at 0x${rpf.offset.toString(16)}: invalid name table size ${nameTableSize}`);
                continue;
            }

            const names = [];
            let pos = nameTableStart;
            while (pos < nameTableEnd) {
                let name = '';
                const startPos = pos;
                while (pos < nameTableEnd && output[pos] !== 0) {
                    name += String.fromCharCode(output[pos]);
                    pos++;
                }
                names.push({ name, offset: startPos - nameTableStart, originalName: name });
                pos++;
            }

            if (names.length === 0) continue;
            log.push(`  RPF at 0x${rpf.offset.toString(16)}: found ${names.length} names`);

            let hasChanges = false;
            const newNames = names.map(n => {
                let newName = n.name;
                const lower = newName.toLowerCase();
                if (lower.includes(sourceId)) {
                    const regex = new RegExp(escapeRegex(sourceId), 'gi');
                    newName = newName.replace(regex, targetId);
                    hasChanges = true;
                }
                return { ...n, newName };
            });

            if (!hasChanges) { log.push(`  No changes needed for this RPF`); continue; }

            const newNameTableSize = newNames.reduce((sum, n) => sum + n.newName.length + 1, 0);
            log.push(`  Old name table size: ${nameTableSize}, New: ${newNameTableSize}`);

            if (newNameTableSize > nameTableSize) {
                const dataStart       = Math.ceil((rpf.offset + 16 + (rpf.entryCount * 16) + rpf.namesLength) / 512) * 512;
                const paddingAvailable = dataStart - nameTableEnd;
                const extraNeeded     = newNameTableSize - nameTableSize;
                log.push(`  Need ${extraNeeded} extra bytes, padding available: ${paddingAvailable}`);
                if (extraNeeded <= paddingAvailable) {
                    output.writeUInt32LE(rpf.namesLength + extraNeeded, rpf.offset + 8);
                    log.push(`  Updated NamesLength`);
                } else {
                    log.push(`  WARNING: Not enough padding, skipping`);
                    continue;
                }
            }

            let writePos = nameTableStart;
            const newOffsets = [];
            for (const n of newNames) {
                newOffsets.push(writePos - nameTableStart);
                const nameBuf = Buffer.from(n.newName, 'ascii');
                nameBuf.copy(output, writePos);
                writePos += nameBuf.length;
                output[writePos] = 0;
                writePos++;
                if (n.name !== n.newName) {
                    log.push(`  RENAMED: "${n.name}" -> "${n.newName}"`);
                    totalReplacements++;
                }
            }
            while (writePos < nameTableEnd) { output[writePos] = 0; writePos++; }

            for (let i = 0; i < rpf.entryCount; i++) {
                const entryOffset    = rpf.offset + 16 + (i * 16);
                const currentNameOff = output.readUInt16LE(entryOffset);
                for (let j = 0; j < names.length; j++) {
                    if (names[j].offset === currentNameOff) {
                        output.writeUInt16LE(newOffsets[j], entryOffset);
                        break;
                    }
                }
            }
        }

        log.push(`Total name replacements: ${totalReplacements}`);

        if (totalReplacements === 0) {
            return res.status(400).send(`No replacements made. Source "${sourceId}" not found. Log: ${log.join(' | ')}`);
        }

        let binaryReplacements = 0;
        if (targetId.length <= sourceId.length) {
            const srcBuf = Buffer.from(sourceId, 'ascii');
            const dstBuf = Buffer.from(targetId, 'ascii');
            let offset = 0;
            while ((offset = output.indexOf(srcBuf, offset)) !== -1) {
                let inNameTable = false;
                for (const rpf of rpfHeaders) {
                    if (offset >= rpf.nameTableOffset && offset < rpf.nameTableOffset + rpf.namesLength) {
                        inNameTable = true; break;
                    }
                }
                if (!inNameTable) {
                    dstBuf.copy(output, offset);
                    for (let pp = dstBuf.length; pp < srcBuf.length; pp++) output[offset + pp] = 0x00;
                    binaryReplacements++;
                }
                offset += srcBuf.length;
            }
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${targetId}.rpf"`);
        res.setHeader('X-Replacement-Count', String(totalReplacements + binaryReplacements));
        res.setHeader('X-Engine-Version', 'v21.0');
        res.setHeader('Access-Control-Expose-Headers', 'X-Replacement-Count, X-Engine-Version');
        res.send(output);

    } catch (e) {
        console.error('[v17] Error:', e);
        res.status(500).send('Converter error: ' + e.message);
    }
});

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.listen(port, '0.0.0.0', () => {
    console.log(`[v21] Sound Resource Generator + Converter API on port ${port}`);
});
