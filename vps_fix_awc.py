import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

stdin, stdout, stderr = client.exec_command('cat /var/www/lhc-node/vps_server_v32.js')
current = stdout.read().decode(errors='replace')

# Fix 1: headerDataSize 32 → headerSize (2048)
OLD1 = '    awc.writeUInt32LE(32, 12);'
NEW1 = '    awc.writeUInt32LE(headerSize, 12);'

# Fix 2: Remove streaming flag (2<<29) from stream entry
OLD2 = '    awc.writeUInt32LE((2 << 29) | (streamId & 0x1FFFFFFF), 16);'
NEW2 = '    awc.writeUInt32LE(streamId & 0x1FFFFFFF, 16);'

# Fix 3: channels=1 (mono) in SFX info block, and remove stale line
OLD3 = '    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);\n    awc.writeUInt8(0x00, sfxInfoOff + 24);'
NEW3 = '    awc.writeUInt16LE(sampleRate, sfxInfoOff + 8);\n    awc.writeUInt8(1, sfxInfoOff + 10);'

errors = []
for i, (old, new_) in enumerate([(OLD1, NEW1), (OLD2, NEW2), (OLD3, NEW3)], 1):
    if old not in current:
        errors.append(f'Fix {i} pattern NOT FOUND')
        # show surrounding context
        key = old.strip()[:30]
        idx = current.find(key[:20])
        if idx >= 0:
            print(f'Context around fix {i}:')
            print(repr(current[max(0,idx-5):idx+120]))
    else:
        current = current.replace(old, new_)
        print(f'Fix {i} applied OK')

if errors:
    print('\nERRORS:', errors)
    client.close()
    exit(1)

sftp = client.open_sftp()
with sftp.open('/var/www/lhc-node/vps_server_v32.js', 'w') as f:
    f.write(current)
sftp.close()

stdin, stdout, stderr = client.exec_command('systemctl restart lhc-node.service && sleep 2 && systemctl is-active lhc-node.service')
print('Service:', stdout.read().decode().strip())

# Verify changes in file
stdin, stdout, stderr = client.exec_command('grep -n "headerSize\|0x1FFFFFFF\|sfxInfoOff + 10\|writeUInt32LE(32" /var/www/lhc-node/vps_server_v32.js')
print('Verify:')
print(stdout.read().decode(errors='replace'))

client.close()
