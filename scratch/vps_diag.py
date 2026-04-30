import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

cmds = [
    ('KEY FILES',    'ls -lh /opt/lhc-keys/'),
    ('AES KEY SIZE', 'wc -c /opt/lhc-keys/gtav_aes_key.dat 2>&1 || echo NOT_FOUND'),
    ('SERVICE',      'systemctl is-active lhc-node.service'),
    ('LOG LAST 40',  'journalctl -u lhc-node.service -n 40 --no-pager'),
]

for label, cmd in cmds:
    _, out, _ = client.exec_command(cmd)
    print(f'\n=== {label} ===')
    print(out.read().decode(errors='replace').strip())

client.close()
