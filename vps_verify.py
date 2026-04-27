import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

stdin, stdout, stderr = client.exec_command('grep -n "fxmanifest\\|AUDIO_WAVEPACK\\|stream/" /var/www/lhc-node/vps_server_v32.js')
print(stdout.read().decode(errors='replace'))
client.close()
