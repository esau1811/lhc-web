const fs = require('fs');

let il = fs.readFileSync('/var/www/lhc-node/ArchiveFix.il', 'utf8');

// Replace the method body
il = il.replace(/get_IsInvokedFromConsole \(\)  cil managed\s*\{[\s\S]*?\} \/\/ end of method Program::get_IsInvokedFromConsole/, 
`get_IsInvokedFromConsole () cil managed {
    .maxstack 8
    IL_0000: ldc.i4.1
    IL_0001: ret
} // end of method Program::get_IsInvokedFromConsole`);

// Remove the DllImport for GetConsoleProcessList since we don't need it anymore and it might cause IL syntax issues or warnings
il = il.replace(/\.method private hidebysig static pinvokeimpl\("kernel32\.dll" as "GetConsoleProcessList" winapi\)[\s\S]*?\} \/\/ end of method Program::GetConsoleProcessList/, '');

fs.writeFileSync('/var/www/lhc-node/ArchiveFix.il', il);
console.log('Patch applied successfully.');
