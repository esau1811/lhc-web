using System;
using System.IO;
using CodeWalker.GameFiles;

class Program {
    static void Main(string[] args) {
        foreach (var arg in args) {
            Console.WriteLine("=== " + arg + " ===");
            try {
                var rpf = new RpfFile(arg, arg);
                if (rpf.ScanStructure()) {
                    DumpEntry(rpf.Root, "");
                } else {
                    Console.WriteLine("ScanStructure failed");
                }
            } catch (Exception ex) {
                Console.WriteLine("Error: " + ex.Message);
            }
        }
    }
    
    static void DumpEntry(RpfEntry entry, string prefix) {
        if (entry is RpfDirectoryEntry dir) {
            Console.WriteLine(prefix + "[" + dir.Name + "]");
            foreach (var child in dir.Children) DumpEntry(child, prefix + "  ");
        } else if (entry is RpfFileEntry file) {
            Console.WriteLine(prefix + file.Name + " | Size: " + file.FileSize + " | Res: " + (file is RpfResourceFileEntry));
        }
    }
}