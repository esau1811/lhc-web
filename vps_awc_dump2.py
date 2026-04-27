import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

stdin, stdout, stderr = client.exec_command('node /tmp/dump_awc.js 2>&1; echo EXIT_CODE:$?')
out = stdout.read()
sys.stdout.buffer.write(out)
sys.stdout.buffer.write(b'\n')

client.close()
