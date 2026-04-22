const { Client } = require('ssh2');
const conn = new Client();

const programCs = `
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

app.UseCors("AllowAll");
app.MapControllers();

app.Run();
`;

conn.on('ready', () => {
    console.log('SSH Ready. Updating Program.cs with CORS policy...');
    conn.exec(`cat <<EOF > /var/www/lhc-csharp/CodeWalkerApi/Program.cs\n${programCs}\nEOF`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('Program.cs updated. Restarting service...');
            conn.exec("systemctl restart lhc-api.service", (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', (code2) => {
                    console.log('Service restarted with code ' + code2);
                    conn.end();
                });
            });
        }).on('data', (data) => process.stdout.write(data))
          .stderr.on('data', (data) => process.stderr.write(data));
    });
}).connect({
    host: '187.33.157.103',
    port: 22,
    username: 'root',
    password: 'diScordLhcds032.w'
});
