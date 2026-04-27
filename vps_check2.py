import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# 1. Show the full injection endpoint (ZIP generation)
stdin, stdout, stderr = client.exec_command(
    "awk '/app\\.post.*inject/,/^app\\./' /var/www/lhc-node/vps_server_v32.js | head -120"
)
print("=== INJECTION ENDPOINT ===")
print(stdout.read().decode(errors='replace'))

# 2. Check if there's a WEAPONS_PLAYER.rpf reference on the server
stdin, stdout, stderr = client.exec_command(
    'find /opt /var/www /tmp -name "*.rpf" 2>/dev/null'
)
print("=== RPF FILES ON SERVER ===")
print(stdout.read().decode(errors='replace'))

# 3. Dump raw hex of first few bytes of first AWC in RESIDENT.rpf (as reference)
# to compare with what we know
stdin, stdout, stderr = client.exec_command(
    'node -e "const fs=require(\'fs\'); const b=fs.readFileSync(\'/opt/lhc-sound/RESIDENT.rpf\'); console.log(\'RPF magic:\',b.slice(0,4).toString(\'hex\')); console.log(\'encType:\',b.readUInt32LE(12).toString(16)); console.log(\'entries:\',b.readUInt32LE(4));" 2>&1'
)
print("=== RESIDENT.RPF HEADER ===")
print(stdout.read().decode(errors='replace'))

# 4. Check duplicate functions
stdin, stdout, stderr = client.exec_command(
    'grep -c "function buildAwc" /var/www/lhc-node/vps_server_v32.js'
)
print("=== buildAwc count ===", stdout.read().decode().strip())

stdin, stdout, stderr = client.exec_command(
    'grep -c "function wavParsePcm" /var/www/lhc-node/vps_server_v32.js'
)
print("=== wavParsePcm count ===", stdout.read().decode().strip())

client.close()
