import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = '187.33.157.103'
user = 'root'
password = 'diScordLhcds032.w'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

# Read current file
stdin, stdout, stderr = client.exec_command('cat /var/www/lhc-node/vps_server_v32.js')
current = stdout.read().decode(errors='replace')

# The patch: replace the zip creation block in the inject endpoint
OLD = "        const zip = new AdmZip(); zip.addFile(`LHC Sound boost/${rpfName}`, modifiedRpf);"

NEW = """        const rpfNameNoExt = rpfName.replace(/\\.rpf$/i, '');
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

if OLD not in current:
    print("ERROR: Pattern not found in file!")
    print("Looking for:")
    print(repr(OLD))
    # Show what's actually there around "AdmZip"
    idx = current.find('AdmZip')
    print("\nActual content around AdmZip:")
    print(repr(current[max(0,idx-10):idx+200]))
    client.close()
    exit(1)

patched = current.replace(OLD, NEW)

print("Patch applied in memory. Writing to VPS...")

# Write patched file via SFTP
sftp = client.open_sftp()
with sftp.open('/var/www/lhc-node/vps_server_v32.js', 'w') as f:
    f.write(patched)
sftp.close()

print("File written. Restarting service...")
stdin, stdout, stderr = client.exec_command('systemctl restart lhc-node.service && sleep 2 && systemctl status lhc-node.service --no-pager')
out = stdout.read().decode(errors='replace')
err = stderr.read().decode(errors='replace')
print(out)
if err: print("STDERR:", err)

client.close()
print("Done!")
