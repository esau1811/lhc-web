const rpf=require('fs').readFileSync('/tmp/uploaded_user.rpf');
const m=Buffer.from('AWC ');
let found=[];
for(let i=0;i<rpf.length-4;i++) {
    if(rpf[i]===m[0]&&rpf[i+1]===m[1]&&rpf[i+2]===m[2]&&rpf[i+3]===m[3]) {
        found.push(i);
    }
}
console.log('AWC magic found at offsets:', found.length > 0 ? found.join(', ') : 'NONE');
