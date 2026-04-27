import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

cmds = [
    'ls -la /opt/lhc-sound/ 2>&1',
    'ls -la /opt/ 2>&1',
    'find /opt -name "*.rpf" 2>/dev/null',
    'find /var/www -name "*.rpf" 2>/dev/null',
]
for c in cmds:
    stdin, stdout, stderr = client.exec_command(c)
    out = stdout.read().decode(errors='replace')
    print(f"=== {c} ===\n{out}")

client.close()
