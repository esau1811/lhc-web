import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Get openRpfBuffer function
stdin, stdout, stderr = client.exec_command(
    'grep -n "function openRpfBuffer\\|function convertToWav\\|ENC_OPEN\\|ENC_AES\\|ENC_NG" /var/www/lhc-node/vps_server_v32.js | head -20'
)
print("=== KEY CONSTANTS/FUNCTIONS ===")
print(stdout.read().decode(errors='replace'))

# Get openRpfBuffer body
stdin, stdout, stderr = client.exec_command(
    'awk "/function openRpfBuffer/,/^function [a-z]/" /var/www/lhc-node/vps_server_v32.js | head -60'
)
print("=== openRpfBuffer BODY ===")
print(stdout.read().decode(errors='replace'))

# Generate a real modified RPF using the server's own code with a tiny test WAV,
# then dump its first 80 bytes and a random AWC's structure
test_script = r"""
'use strict';
const fs = require('fs');
const path = require('path');

// Load the actual server module functions by eval-ing the server file
// We'll just read the relevant portion

// Create a minimal 32-sample test WAV
const pcmSamples = 3200; // 0.1s @ 32kHz
const wavBuf = Buffer.alloc(44 + pcmSamples * 2, 0);
wavBuf.write('RIFF', 0);
wavBuf.writeUInt32LE(36 + pcmSamples * 2, 4);
wavBuf.write('WAVE', 8);
wavBuf.write('fmt ', 12);
wavBuf.writeUInt32LE(16, 16);
wavBuf.writeUInt16LE(1, 20); // PCM
wavBuf.writeUInt16LE(1, 22); // mono
wavBuf.writeUInt32LE(32000, 24);
wavBuf.writeUInt32LE(64000, 28);
wavBuf.writeUInt16LE(2, 32);
wavBuf.writeUInt16LE(16, 34);
wavBuf.write('data', 36);
wavBuf.writeUInt32LE(pcmSamples * 2, 40);

// Read the server's last processed output if any temp files exist
const tmpFiles = fs.readdirSync('/tmp').filter(f => f.endsWith('.rpf') || f.endsWith('.zip'));
console.log('Temp RPF/ZIP files:', tmpFiles);

// Try to read FiveM-related paths to understand what user has
console.log('Done');
"""
sftp = client.open_sftp()
with sftp.open('/tmp/check_rpf.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('node /tmp/check_rpf.js 2>&1')
print("=== TEMP FILES CHECK ===")
print(stdout.read().decode(errors='replace'))

# Check if there's any recent processed file in /tmp
stdin, stdout, stderr = client.exec_command('ls -la /tmp/*.rpf /tmp/*.zip /tmp/*.awc 2>/dev/null | head -10')
print("=== RECENT PROCESSED FILES ===")
print(stdout.read().decode(errors='replace'))

client.close()
