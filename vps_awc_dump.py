import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Write the script to a file and run it
script = """'use strict';
const fs = require('fs');
const crypto = require('crypto');

const KEYS_DIR = '/opt/lhc-keys';
const RPF_PATH = '/opt/lhc-sound/RESIDENT.rpf';
const ENC_AES  = 0x0FFFFFF9;

const aesKey = fs.readFileSync(KEYS_DIR + '/gtav_aes_key.dat');
const rpfRaw = fs.readFileSync(RPF_PATH);

const encType = rpfRaw.readUInt32LE(12);
const entryCount = rpfRaw.readUInt32LE(4);
const namesLength = rpfRaw.readUInt32LE(8);
const headerLen = entryCount * 16 + namesLength;
const encBlock = rpfRaw.slice(16, 16 + headerLen);

let decBlock;
if (encType === ENC_AES) {
    const d = crypto.createDecipheriv('aes-256-ecb', aesKey, null);
    d.setAutoPadding(false);
    decBlock = Buffer.concat([d.update(encBlock.slice(0, Math.floor(encBlock.length/16)*16)), d.final()]);
    if (encBlock.length % 16) decBlock = Buffer.concat([decBlock, encBlock.slice(decBlock.length)]);
} else {
    decBlock = encBlock;
}

const rpf = Buffer.from(rpfRaw);
decBlock.copy(rpf, 16);

const nameTableStart = 16 + entryCount * 16;
for (let i = 0; i < entryCount; i++) {
    const eOff = 16 + i * 16;
    if (rpf.readUInt32LE(eOff + 4) === 0x7FFFFF00) continue;
    const nameOff = rpf.readUInt16LE(eOff);
    let name = '';
    let p = nameTableStart + nameOff;
    while (p < nameTableStart + namesLength && rpf[p] !== 0) name += String.fromCharCode(rpf[p++]);
    if (name.toLowerCase().endsWith('.awc')) {
        const page = rpf[eOff+5] | (rpf[eOff+6]<<8) | (rpf[eOff+7]<<16);
        const size = rpf.readUInt32LE(eOff + 8);
        const awcData = rpf.slice(page * 512, page * 512 + Math.min(size, 512));
        console.log('AWC:', name, 'page:', page, 'size:', size);
        console.log('HEX256:', awcData.slice(0, 256).toString('hex'));
        // Also dump all AWC names
    }
}
"""

sftp = client.open_sftp()
with sftp.open('/tmp/dump_awc.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/dump_awc.js 2>&1')
out = stdout.read().decode(errors='replace')
print(out)

client.close()
