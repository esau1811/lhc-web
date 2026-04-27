import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.33.157.103', username='root', password='diScordLhcds032.w', timeout=15)

# Find all .cs source files in CodeWalkerApi (not obj/bin)
stdin, stdout, stderr = client.exec_command(
    'find /var/www/lhc-csharp/CodeWalkerApi -name "*.cs" | grep -v "/obj/" | grep -v "/bin/"'
)
cs_files = stdout.read().decode(errors='replace').strip().split('\n')
print("C# source files:", cs_files)

for f in cs_files:
    if f.strip():
        print(f"\n{'='*60}\nFILE: {f}\n{'='*60}")
        stdin, stdout, stderr = client.exec_command(f'cat "{f.strip()}"')
        print(stdout.read().decode(errors='replace'))

# Also check what port CodeWalkerApi runs on
print("\n=== appsettings ===")
stdin, stdout, stderr = client.exec_command('cat /var/www/lhc-csharp/CodeWalkerApi/appsettings.json')
print(stdout.read().decode(errors='replace'))

client.close()
