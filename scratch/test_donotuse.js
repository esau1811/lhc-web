const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
    c.exec('cp /tmp/uploaded_user.rpf /tmp/test_decrypt.rpf && xvfb-run wine /var/www/lhc-node/ArchiveFix.exe donotuse_really /tmp/test_decrypt.rpf 2>&1 | cat; echo EXIT_CODE_END', (e,s)=>{
        let out='';
        s.on('data',d=>{ out+=d; process.stdout.write(d); });
        s.on('close',()=>{
            c.exec('node /tmp/check_et.js', (e2,s2)=>{
                s2.on('data',d=>process.stdout.write(d));
                s2.on('close',()=>c.end());
            });
        });
    });
}).connect({host:'187.33.157.103',port:22,username:'root',password:'diScordLhcds032.w'});
