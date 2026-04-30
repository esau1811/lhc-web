using System;
using System.IO;
using System.Collections.Generic;
using CodeWalker.GameFiles;

class Program
{
    static void Main(string[] args)
    {
        try
        {
            Console.WriteLine("Loading GTA5 Keys manually...");
            
            // Load AES key
            if (File.Exists("gtav_aes_key.dat")) {
                GTA5Keys.PC_AES_KEY = File.ReadAllBytes("gtav_aes_key.dat");
                Console.WriteLine("Loaded AES key.");
            }
            
            // Load NG keys
            if (File.Exists("gtav_ng_key.dat")) {
                byte[] keyData = File.ReadAllBytes("gtav_ng_key.dat");
                if (keyData.Length == 27472) {
                    GTA5Keys.PC_NG_KEYS = new byte[101][];
                    for (int i = 0; i < 101; i++) {
                        GTA5Keys.PC_NG_KEYS[i] = new byte[272];
                        Array.Copy(keyData, i * 272, GTA5Keys.PC_NG_KEYS[i], 0, 272);
                    }
                    Console.WriteLine("Loaded NG keys.");
                }
            }

            string rpfPath = "/tmp/uploaded_user.rpf";
            Console.WriteLine("Loading RPF: " + rpfPath);
            RpfFile rpf = new RpfFile(rpfPath, rpfPath);
            
            Console.WriteLine("Scanning structure...");
            rpf.ScanStructure(null, null);
            Console.WriteLine("Structure scanned. Entry count: " + rpf.AllEntries.Count);

            foreach (var entry in rpf.AllEntries)
            {
                if (entry is RpfBinaryFileEntry bin)
                {
                    if (bin.Name.ToLower().EndsWith(".awc"))
                    {
                        Console.WriteLine("Found AWC: " + bin.Name);
                        Console.WriteLine("  Uncompressed Size: " + bin.FileUncompressedSize);
                        Console.WriteLine("  Encryption Type: " + bin.EncryptionType);
                        
                        byte[] data = rpf.ExtractFile(bin);
                        Console.WriteLine("  Extracted Size: " + data.Length);
                        Console.WriteLine("  Magic: " + data[0].ToString("x2") + " " + data[1].ToString("x2") + " " + data[2].ToString("x2") + " " + data[3].ToString("x2"));
                        
                        // Save it
                        File.WriteAllBytes("lmg_out.awc", data);
                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.ToString());
        }
    }
}
