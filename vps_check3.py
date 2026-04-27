import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Get the injection endpoint — search from the line number
stdin, stdout, stderr = client.exec_command(
    'grep -n "app.post" /var/www/lhc-node/vps_server_v32.js'
)
print("=== ALL app.post ROUTES ===")
routes = stdout.read().decode(errors='replace')
print(routes)

# Find inject endpoint line number and dump 80 lines from there
inject_line = None
for line in routes.splitlines():
    if 'inject' in line:
        inject_line = int(line.split(':')[0])
        break

if inject_line:
    stdin, stdout, stderr = client.exec_command(
        f'sed -n "{inject_line},{inject_line+100}p" /var/www/lhc-node/vps_server_v32.js'
    )
    print(f"=== INJECT ENDPOINT (lines {inject_line}+) ===")
    print(stdout.read().decode(errors='replace'))

# Also get total line count to understand file size
stdin, stdout, stderr = client.exec_command(
    'wc -l /var/www/lhc-node/vps_server_v32.js'
)
print("=== TOTAL LINES ===", stdout.read().decode().strip())

# Check duplicate functions — show the line numbers of duplicates
stdin, stdout, stderr = client.exec_command(
    'grep -n "function wavParsePcm\\|function buildAwc\\|function wavToAwc" /var/www/lhc-node/vps_server_v32.js'
)
print("=== FUNCTION DEFINITIONS ===")
print(stdout.read().decode(errors='replace'))

client.close()
