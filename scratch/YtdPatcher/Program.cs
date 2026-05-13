using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using CodeWalker.GameFiles;

class Program
{
    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("=== LHC YtdPatcher — FiveM Weapon Skin Tool ===\n");

        if (args.Length < 3)
        {
            Console.WriteLine("Uso: YtdPatcher.exe <weapon.dds> <weapon_name> <assets_dir> [<supp.dds|none> <supp_name>]");
            return;
        }

        string ddsPath   = args[0];
        string weaponName = args[1];
        string assetsDir  = args[2];
        string suppDds   = args.Length > 3 ? args[3] : null;
        string suppName  = args.Length > 4 ? args[4] : null;

        // ── Weapon YTD ──────────────────────────────────────────────────
        string ytdPath = Path.Combine(assetsDir, weaponName + ".ytd");
        if (!File.Exists(ddsPath))  { Console.WriteLine($"Error: DDS no encontrado: {ddsPath}");  return; }
        if (!File.Exists(ytdPath))  { Console.WriteLine($"Error: YTD no encontrado: {ytdPath}");  return; }

        Console.WriteLine($"Cargando arma: {weaponName}");
        var weaponYtd = PatchYtd(File.ReadAllBytes(ytdPath), File.ReadAllBytes(ddsPath), weaponName);
        Console.WriteLine($"  OK: {weaponYtd.Length / 1024} KB");

        // ── Build file list ─────────────────────────────────────────────
        var files = new List<(string name, byte[] data)>
        {
            (weaponName + ".ytd",      weaponYtd),
            (weaponName + "+hi.ytd",   weaponYtd),
        };

        // ── Suppressor (optional) ────────────────────────────────────────
        if (!string.IsNullOrEmpty(suppName))
        {
            string suppDir     = Path.Combine(assetsDir, "silenciadores");
            string suppYdrPath = Path.Combine(suppDir, suppName + ".ydr");
            string suppHiYdr   = Path.Combine(suppDir, suppName + "_hi.ydr");
            string suppYtdPath = Path.Combine(suppDir, suppName + ".ytd");

            Console.WriteLine($"\nCargando silenciador: {suppName}");

            if (File.Exists(suppYdrPath))
            {
                files.Add((suppName + ".ydr", File.ReadAllBytes(suppYdrPath)));
                Console.WriteLine($"  YDR base: OK");
            }
            if (File.Exists(suppHiYdr))
            {
                files.Add((suppName + "_hi.ydr", File.ReadAllBytes(suppHiYdr)));
                Console.WriteLine($"  YDR hi: OK");
            }
            if (File.Exists(suppYtdPath))
            {
                byte[] suppYtd;
                bool hasDds = !string.IsNullOrEmpty(suppDds)
                              && suppDds.ToLower() != "none"
                              && File.Exists(suppDds);

                if (hasDds)
                {
                    suppYtd = PatchYtd(File.ReadAllBytes(suppYtdPath), File.ReadAllBytes(suppDds), suppName);
                    Console.WriteLine($"  YTD pintado: {suppYtd.Length / 1024} KB");
                }
                else
                {
                    suppYtd = File.ReadAllBytes(suppYtdPath);
                    Console.WriteLine($"  YTD original: {suppYtd.Length / 1024} KB");
                }
                files.Add((suppName + ".ytd", suppYtd));
            }
        }

        // ── Build RPF ────────────────────────────────────────────────────
        Console.WriteLine($"\nConstruyendo RPF con {files.Count} archivos...");
        var rpf = BuildRpf7(files);
        Console.WriteLine($"  RPF: {rpf.Length / 1024} KB");

        var outPath = Path.Combine(Directory.GetCurrentDirectory(), weaponName + ".rpf");
        File.WriteAllBytes(outPath, rpf);
        Console.WriteLine($"\n✅ RPF generado: {outPath}");
    }

    // ── PatchYtd ──────────────────────────────────────────────────────────
    static byte[] PatchYtd(byte[] ytdBytes, byte[] ddsBytes, string textureName)
    {
        ParseDdsHeader(ddsBytes, out int ddsW, out int ddsH);
        int pixelOffset = 128;
        var pixelData = new byte[ddsBytes.Length - pixelOffset];
        Array.Copy(ddsBytes, pixelOffset, pixelData, 0, pixelData.Length);

        var ytd = new YtdFile();
        ytd.Load(ytdBytes);

        var items = (Texture[])ytd.TextureDict.Textures.GetType()
            .GetProperty("data_items").GetValue(ytd.TextureDict.Textures);

        if (items == null || items.Length == 0)
            throw new Exception("Sin texturas en YTD: " + textureName);

        // Find diffuse texture (exact name match, then fallback to largest)
        int idx = -1;
        for (int i = 0; i < items.Length; i++)
            if (items[i] != null &&
                string.Equals(items[i].Name, textureName, StringComparison.OrdinalIgnoreCase))
            { idx = i; break; }

        if (idx < 0)
            idx = items.Select((t, i) => (t, i))
                       .Where(x => x.t != null)
                       .OrderByDescending(x => x.t.Width * x.t.Height)
                       .First().i;

        var tex = items[idx];
        Console.WriteLine($"  Textura: '{tex.Name}' {tex.Width}x{tex.Height} {tex.Format}");

        tex.Width  = (ushort)ddsW;
        tex.Height = (ushort)ddsH;
        tex.Levels = 1;

        try { tex.Format = (TextureFormat)Enum.Parse(typeof(TextureFormat), "A8R8G8B8"); }
        catch { }

        if (tex.Data != null)
        {
            var prop = tex.Data.GetType().GetProperty("FullData")
                    ?? tex.Data.GetType().GetProperty("fullData");
            if (prop != null && prop.CanWrite) prop.SetValue(tex.Data, pixelData);
            else
            {
                var field = tex.Data.GetType().GetField("FullData")
                         ?? tex.Data.GetType().GetField("fullData");
                field?.SetValue(tex.Data, pixelData);
            }
        }

        return ytd.Save();
    }

    static void ParseDdsHeader(byte[] dds, out int width, out int height)
    {
        height = dds.Length >= 16 ? BitConverter.ToInt32(dds, 12) : 0;
        width  = dds.Length >= 20 ? BitConverter.ToInt32(dds, 16) : 0;
    }

    // ── BuildRpf7 ────────────────────────────────────────────────────────
    static byte[] BuildRpf7(List<(string name, byte[] data)> files)
    {
        // Name table
        var nameList = new List<byte> { 0 };
        var nameOffsets = new List<uint>();
        foreach (var (name, _) in files)
        {
            nameOffsets.Add((uint)nameList.Count);
            nameList.AddRange(Encoding.ASCII.GetBytes(name));
            nameList.Add(0);
        }
        while (nameList.Count % 16 != 0) nameList.Add(0);
        byte[] names = nameList.ToArray();

        const int SECTOR    = 512;
        const int HDR_BYTES = 16;
        const int ENTRY_SZ  = 16;
        int N_ENTRIES = 1 + files.Count; // root + files

        int metaSize   = HDR_BYTES + N_ENTRIES * ENTRY_SZ + names.Length;
        int metaPadded = Align(metaSize, SECTOR);

        // Data layout
        var dataOffsets = new List<int>();
        int dataAccum = 0;
        foreach (var (_, data) in files)
        {
            dataOffsets.Add(dataAccum);
            dataAccum += Align(data.Length, SECTOR);
        }
        int total = metaPadded + dataAccum;

        var buf = new byte[total];
        using var ms = new MemoryStream(buf);
        using var bw = new BinaryWriter(ms);

        // Header
        bw.Write(0x52504637u);
        bw.Write((uint)N_ENTRIES);
        bw.Write((uint)names.Length);
        bw.Write(0u);

        // Entry 0 — root directory
        bw.Write(0u);
        bw.Write(0x7FFFFF00u);
        bw.Write(1u);
        bw.Write((uint)files.Count);

        // File entries
        for (int i = 0; i < files.Count; i++)
        {
            var (_, data) = files[i];
            uint vFlag = 0, pFlag = 0;
            if (data.Length >= 16 &&
                data[0] == 'R' && data[1] == 'S' &&
                data[2] == 'C' && data[3] == '7')
            {
                vFlag = BitConverter.ToUInt32(data, 8);
                pFlag = BitConverter.ToUInt32(data, 12);
            }

            bool isRes    = (vFlag != 0 || pFlag != 0);
            uint resFlags = isRes ? (0x80000000u | (vFlag & 0x7FFFFFFFu)) : 0u;
            uint sizeField = isRes ? pFlag : (uint)data.Length;
            int  dataSec   = (metaPadded + dataOffsets[i]) / SECTOR;

            bw.Write(nameOffsets[i]);
            bw.Write(sizeField);
            bw.Write((uint)dataSec);
            bw.Write(resFlags);
        }

        // Name table + padding
        bw.Write(names);
        while (ms.Position < metaPadded) bw.Write((byte)0);

        // File data
        for (int i = 0; i < files.Count; i++)
        {
            var (_, data) = files[i];
            bw.Write(data);
            int pad = Align(data.Length, SECTOR) - data.Length;
            for (int p = 0; p < pad; p++) bw.Write((byte)0);
        }

        return buf;
    }

    static int Align(int v, int a) => ((v + a - 1) / a) * a;
}