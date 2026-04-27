import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

stdin, stdout, stderr = client.exec_command('cat /var/www/lhc-node/vps_server_v32.js')
current = stdout.read().decode(errors='replace')

OLD = """        const rpfNameNoExt = rpfName.replace(/\\.rpf$/i, '');
        const manifest = [
            "fx_version 'cerulean'",
            "game 'gta5'",
            "",
            "files {",
            `  'stream/${rpfName}'`,
            "}",
            "",
            `data_file 'AUDIO_WAVEPACK' 'stream/${rpfNameNoExt}'`,
            "",
        ].join('\\n');
        const zip = new AdmZip();
        zip.addFile('LHC Sound boost/fxmanifest.lua', Buffer.from(manifest, 'utf8'));
        zip.addFile(`LHC Sound boost/stream/${rpfName}`, modifiedRpf);"""

NEW = """        const zip = new AdmZip();
        zip.addFile(`mods/x64/audio/sfx/${rpfName}`, modifiedRpf);"""

if OLD not in current:
    print("ERROR: Pattern not found!")
    idx = current.find('AdmZip')
    print("Around AdmZip:", repr(current[max(0,idx-20):idx+300]))
    client.close()
    exit(1)

patched = current.replace(OLD, NEW)

sftp = client.open_sftp()
with sftp.open('/var/www/lhc-node/vps_server_v32.js', 'w') as f:
    f.write(patched)
sftp.close()

stdin, stdout, stderr = client.exec_command('systemctl restart lhc-node.service && sleep 2 && systemctl is-active lhc-node.service')
print("Service status:", stdout.read().decode().strip())

# Verify
stdin, stdout, stderr = client.exec_command('grep -n "mods/x64/audio" /var/www/lhc-node/vps_server_v32.js')
print("Verify:", stdout.read().decode().strip())

client.close()
print("Done!")
