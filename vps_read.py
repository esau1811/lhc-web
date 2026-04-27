import paramiko

host = '187.33.157.103'
user = 'root'
password = 'diScordLhcds032.w'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

commands = [
    'find /var/www/lhc-api -type f | head -60',
    'find /var/www/lhc-node -type f | head -60',
    'find /var/www/lhc-csharp -type f | head -60',
    'find /opt/awc_gen -type f',
]

for cmd in commands:
    print(f"\n=== {cmd} ===")
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode(errors='replace'))

client.close()
