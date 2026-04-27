import paramiko
import sys

host = '187.33.157.103'
user = 'root'
password = 'diScordLhcds032.w'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(host, username=user, password=password, timeout=15)
    print("Connected!")

    commands = [
        'ls /',
        'ls /app /var/www /root /home 2>/dev/null',
        'find / -maxdepth 5 -name "*.py" -o -name "*.cs" -o -name "Program.cs" 2>/dev/null | grep -v proc | grep -v sys',
        'ps aux | grep -v grep | grep -E "dotnet|node|python|java|nginx|apache"',
        'netstat -tlnp 2>/dev/null | grep LISTEN',
    ]

    for cmd in commands:
        print(f"\n=== CMD: {cmd} ===")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode(errors='replace')
        err = stderr.read().decode(errors='replace')
        if out: print(out)
        if err: print("ERR:", err[:200])

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
