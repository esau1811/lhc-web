import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = '187.33.157.103'
user = 'root'
password = 'diScordLhcds032.w'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

files_to_read = [
    '/var/www/lhc-node/vps_server_v32.js',
    '/opt/awc_gen/Program.cs',
]

for path in files_to_read:
    print(f"\n\n{'='*60}")
    print(f"FILE: {path}")
    print('='*60)
    stdin, stdout, stderr = client.exec_command(f'cat "{path}"')
    content = stdout.read().decode(errors='replace')
    print(content)

print("\n\n=== RUNNING PROCESSES ===")
stdin, stdout, stderr = client.exec_command('pm2 list 2>/dev/null; echo "---"; systemctl list-units --type=service --state=running 2>/dev/null | head -20')
print(stdout.read().decode(errors='replace'))

print("\n=== NGINX SITES ===")
stdin, stdout, stderr = client.exec_command('ls /etc/nginx/sites-enabled/; cat /etc/nginx/sites-enabled/* 2>/dev/null | head -60')
print(stdout.read().decode(errors='replace'))

client.close()
