using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using BCnEncoder.Encoder;
using BCnEncoder.Shared;
using CodeWalker.GameFiles;
using CodeWalker.Utils;

class Program
{
    // ── RPF7 entry helpers ─────────────────────────────────────────────────────
    static void WriteDirEntry(BinaryWriter bw, uint nameOff, uint firstChild, uint count)
    {
        bw.Write(nameOff & 0xFFFFu);
        bw.Write(0x7FFFFF00u);
        bw.Write(firstChild);
        bw.Write(count);
    }

    static void WriteResEntry(BinaryWriter bw, uint nameOff, uint fileSize, uint sectorOff, uint vFlag, uint pFlag)
    {
        byte fs0 = (byte)fileSize, fs1 = (byte)(fileSize >> 8), fs2 = (byte)(fileSize >> 16);
        bw.Write((nameOff & 0xFFFFu) | ((uint)fs0 << 16) | ((uint)fs1 << 24));
        bw.Write((uint)fs2 | (sectorOff << 8) | 0x80000000u);
        bw.Write(vFlag);
        bw.Write(pFlag);
    }

    // diskSize = size stored on disk (compressed); actualSize = f3 (decompressed size)
    static void WriteBinEntry(BinaryWriter bw, uint nameOff, uint diskSize, uint sectorOff, uint actualSize)
    {
        byte fs0 = (byte)diskSize, fs1 = (byte)(diskSize >> 8), fs2 = (byte)(diskSize >> 16);
        bw.Write((nameOff & 0xFFFFu) | ((uint)fs0 << 16) | ((uint)fs1 << 24));
        bw.Write((uint)fs2 | (sectorOff << 8));  // bit 31 = 0 → BIN (not resource)
        bw.Write(actualSize); // f3: decompressed size (== diskSize when not compressed)
        bw.Write(0u);         // f4: unused
    }

    static byte[] ZlibCompress(byte[] data)
    {
        using var ms = new MemoryStream();
        using (var zlib = new ZLibStream(ms, CompressionLevel.Optimal, leaveOpen: true))
            zlib.Write(data, 0, data.Length);
        return ms.ToArray();
    }

    static int Align(int v, int a) => ((v + a - 1) / a) * a;

    // ── Generic RPF7 builder ───────────────────────────────────────────────────
    static byte[] BuildRpf7(int nEntries, byte[] names,
        (string name, byte[] data)[] files,
        Action<BinaryWriter, uint[]> writeEntries)
    {
        const int SECTOR = 512;
        int metaSize   = 16 + nEntries * 16 + names.Length;
        int metaPadded = Align(metaSize, SECTOR);

        // Sector offsets are ABSOLUTE from start of file: dataOff = sectorOff * 512
        // The header occupies sectors 0..(metaPadded/512 - 1), files follow immediately after.
        var secs = new uint[files.Length];
        uint cur = (uint)(metaPadded / SECTOR);
        for (int i = 0; i < files.Length; i++)
        {
            secs[i] = cur;
            cur += (uint)(Align(files[i].data.Length, SECTOR) / SECTOR);
        }

        var buf = new byte[(int)cur * SECTOR];
        using var ms = new MemoryStream(buf);
        using var bw = new BinaryWriter(ms);

        bw.Write(0x52504637u);        // RPF7
        bw.Write((uint)nEntries);
        bw.Write((uint)names.Length);
        bw.Write(0x4E45504Fu);        // OPEN

        writeEntries(bw, secs);

        bw.Write(names);
        while (ms.Position < metaPadded) bw.Write((byte)0);

        // Files start immediately after header (no empty padding sector)
        foreach (var (_, data) in files)
        {
            bw.Write(data);
            int pad = Align(data.Length, SECTOR) - data.Length;
            for (int i = 0; i < pad; i++) bw.Write((byte)0);
        }

        return buf;
    }

    // ── Level 3: streaming.rpf — contains just the weapon YTD ─────────────────
    static byte[] BuildStreamingRpf(string weaponName, byte[] ytdData, uint vFlag, uint pFlag)
    {
        string ytdName = weaponName + ".ytd";

        var nl = new List<byte> { 0 };
        uint no1 = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes(ytdName)); nl.Add(0);
        while (nl.Count % 16 != 0) nl.Add(0);

        return BuildRpf7(2, nl.ToArray(),
            new[] { (ytdName, ytdData) },
            (bw, secs) =>
            {
                WriteDirEntry(bw, 0,   1, 1);
                WriteResEntry(bw, no1, (uint)ytdData.Length, secs[0], vFlag, pFlag);
            });
    }

    // ── Level 2: dlc.rpf — CitizenFX faux DLC with content.xml + setup2.xml + x64/streaming.rpf
    static byte[] BuildDlcRpf(string dlcName, byte[] streamingRpf)
    {
        var contentXml = Encoding.UTF8.GetBytes(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<CDataFileMgr__ContentsOfDataFileXml>\n" +
            "    <dataFiles>\n" +
            "        <Item>\n" +
            $"            <filename>{dlcName}:/%PLATFORM%/streaming.rpf</filename>\n" +
            "            <fileType>RPF_FILE</fileType>\n" +
            "        </Item>\n" +
            "    </dataFiles>\n" +
            "</CDataFileMgr__ContentsOfDataFileXml>");

        var setup2Xml = Encoding.UTF8.GetBytes(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<SSetupData>\n" +
            $"    <deviceName>{dlcName}</deviceName>\n" +
            "</SSetupData>");

        // Entries:
        // [0] DIR ""          firstChild=1  count=3
        // [1] BIN "content.xml"
        // [2] BIN "setup2.xml"
        // [3] DIR "x64"       firstChild=4  count=1
        // [4] BIN "streaming.rpf"
        var nl = new List<byte> { 0 };
        uint noContent = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("content.xml"));   nl.Add(0);
        uint noSetup   = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("setup2.xml"));    nl.Add(0);
        uint noX64     = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("x64"));           nl.Add(0);
        uint noStream  = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("streaming.rpf")); nl.Add(0);
        while (nl.Count % 16 != 0) nl.Add(0);

        var files = new[]
        {
            ("content.xml",   contentXml),
            ("setup2.xml",    setup2Xml),
            ("streaming.rpf", streamingRpf),
        };

        return BuildRpf7(5, nl.ToArray(), files, (bw, secs) =>
        {
            WriteDirEntry(bw, 0,         1, 3);
            WriteBinEntry(bw, noContent, 0u, secs[0], (uint)contentXml.Length);
            WriteBinEntry(bw, noSetup,   0u, secs[1], (uint)setup2Xml.Length);
            WriteDirEntry(bw, noX64,     4, 1);
            WriteBinEntry(bw, noStream,  0u, secs[2], (uint)streamingRpf.Length);
        });
    }

    // ── Level 1: outer RPF — FiveM package with assembly.xml + content/dlc.rpf ─
    static byte[] BuildOuterRpf(string weaponName, string dlcName, byte[] dlcRpf)
    {
        // Jenkins hash for a stable GUID-like ID
        uint h = 0;
        foreach (char c in weaponName) { h = (h + c) * 31u; }

        var assemblyXml = Encoding.UTF8.GetBytes(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            $"<package version=\"2.1\" id=\"{{{h:X8}-0000-0000-0000-000000000000}}\" target=\"Five\">\n" +
            "<metadata>\n" +
            $"<name>LHC_Skin_{weaponName}</name>\n" +
            "<version><major>1</major><minor>0</minor><tag>Public</tag></version>\n" +
            "<author><displayName>LHC</displayName><actionLink>https://fivem.net/</actionLink><web>https://fivem.net/</web></author>\n" +
            "<description footerLink=\"\" footerLinkTitle=\"\"><![CDATA[Custom weapon skin]]></description>\n" +
            "<largeDescription displayName=\"\" footerLink=\"\" footerLinkTitle=\"\"><![CDATA[]]></largeDescription>\n" +
            "<licence footerLink=\"\" footerLinkTitle=\"\"><![CDATA[]]></licence>\n" +
            "</metadata>\n" +
            "<colors>\n" +
            "<headerBackground useBlackTextColor=\"true\">$ffffffff</headerBackground>\n" +
            "<iconBackground>$ffffffff</iconBackground>\n" +
            "</colors>\n" +
            "<content>\n" +
            $"<add source=\"SKin.rpf\">update/x64/dlcpacks/{dlcName}/dlc.rpf</add>\n" +
            "</content>\n" +
            "</package>");

        // Entries:
        // [0] DIR ""          firstChild=1  count=2
        // [1] BIN "assembly.xml"
        // [2] DIR "content"   firstChild=3  count=1
        // [3] BIN "dlc.rpf"
        var nl = new List<byte> { 0 };
        uint noAssembly = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("assembly.xml")); nl.Add(0);
        uint noContent  = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("content"));      nl.Add(0);
        uint noSkin     = (uint)nl.Count; nl.AddRange(Encoding.ASCII.GetBytes("SKin.rpf"));     nl.Add(0);
        while (nl.Count % 16 != 0) nl.Add(0);

        var files = new[]
        {
            ("assembly.xml", assemblyXml),
            ("SKin.rpf",     dlcRpf),
        };

        // diskSize=0 means uncompressed (GTA5 RPF7 convention); f3=actual size on disk
        return BuildRpf7(4, nl.ToArray(), files, (bw, secs) =>
        {
            WriteDirEntry(bw, 0,          1, 2);
            WriteBinEntry(bw, noAssembly, 0u, secs[0], (uint)assemblyXml.Length);
            WriteDirEntry(bw, noContent,  3, 1);
            WriteBinEntry(bw, noSkin,     0u, secs[1], (uint)dlcRpf.Length);
        });
    }

    // ── Main ──────────────────────────────────────────────────────────────────
    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.WriteLine("=== LHC YtdPatcher — FiveM Weapon Skin Tool ===\n");

        if (args.Length == 0)
        {
            Console.WriteLine("Uso:  YtdPatcher.exe <custom.dds> <nombre_arma> <assets_dir>");
            return;
        }

        string ddsPath    = args[0];
        string weaponName = args.Length > 1 ? args[1] : "w_pi_combatpistol";
        string assetsDir  = args.Length > 2 ? args[2] : Directory.GetCurrentDirectory();
        string ytdPath    = Path.Combine(assetsDir, weaponName + ".ytd");

        if (!File.Exists(ddsPath)) { Console.WriteLine($"Error: DDS no encontrado: {ddsPath}"); return; }
        if (!File.Exists(ytdPath)) { Console.WriteLine($"Error: YTD no encontrado: {ytdPath}");  return; }

        Console.WriteLine($"Cargando DDS: {Path.GetFileName(ddsPath)}");
        var ddsBytes = File.ReadAllBytes(ddsPath);
        ParseDdsHeader(ddsBytes, out int ddsW, out int ddsH);
        var bgraPixels = new byte[ddsBytes.Length - 128];
        Array.Copy(ddsBytes, 128, bgraPixels, 0, bgraPixels.Length);
        Console.WriteLine($"  {ddsW}x{ddsH}  {bgraPixels.Length} bytes");

        if (bgraPixels.Length == 0 || ddsW == 0 || ddsH == 0)
        { Console.WriteLine("Error: DDS sin datos"); return; }

        Console.WriteLine($"Cargando YTD: {weaponName}.ytd");
        var ytd = new YtdFile();
        ytd.Load(File.ReadAllBytes(ytdPath));

        var items = (Texture[])ytd.TextureDict.Textures.GetType()
            .GetProperty("data_items").GetValue(ytd.TextureDict.Textures);
        if (items == null || items.Length == 0) { Console.WriteLine("Error: sin texturas"); return; }

        Console.WriteLine($"  Texturas ({items.Length}):");
        foreach (var t in items.Where(t => t != null))
            Console.WriteLine($"    {t.Name}  {t.Width}x{t.Height}  {t.Format}");

        int idx = -1;
        for (int i = 0; i < items.Length; i++)
            if (items[i] != null && string.Equals(items[i].Name, weaponName, StringComparison.OrdinalIgnoreCase))
            { idx = i; break; }

        if (idx < 0)
        {
            idx = items.Select((t, i) => (t, i)).Where(x => x.t != null)
                       .OrderByDescending(x => x.t.Width * x.t.Height).First().i;
            Console.WriteLine($"  '{weaponName}' no hallada — usando '{items[idx].Name}'");
        }

        var tex = items[idx];
        string texName = tex.Name;
        Console.WriteLine($"  Reemplazando: '{texName}' {tex.Width}x{tex.Height} {tex.Format}");

        bool bc3 = !tex.Format.ToString().Contains("DXT1") && !tex.Format.ToString().Contains("BC1");
        Console.WriteLine($"Comprimiendo a {(bc3 ? "DXT5/BC3" : "DXT1/BC1")}...");
        var dxt5Dds = CompressToDxt5Dds(bgraPixels, ddsW, ddsH, bc3);
        Console.WriteLine($"  DDS: {dxt5Dds.Length} bytes");

        Console.WriteLine("Creando Texture via DDSIO...");
        var newTex = DDSIO.GetTexture(dxt5Dds);
        if (newTex == null) { Console.WriteLine("Error: DDSIO.GetTexture null"); return; }
        newTex.Name = texName;
        Console.WriteLine($"  '{newTex.Name}' {newTex.Width}x{newTex.Height}  Data={newTex.Data?.BlockLength}b");

        items[idx] = newTex;

        Console.WriteLine("Guardando YTD...");
        var ytdBytes = ytd.Save();
        uint vFlag = BitConverter.ToUInt32(ytdBytes, 8);
        uint pFlag = BitConverter.ToUInt32(ytdBytes, 12);
        Console.WriteLine($"  {ytdBytes.Length} bytes  vFlag=0x{vFlag:x8}  pFlag=0x{pFlag:x8}");

        // Build 3-level FiveM package RPF
        string dlcName = "lhc_" + weaponName;

        Console.WriteLine("Construyendo streaming.rpf...");
        var streamingRpf = BuildStreamingRpf(weaponName, ytdBytes, vFlag, pFlag);
        Console.WriteLine($"  {streamingRpf.Length} bytes");

        Console.WriteLine("Construyendo dlc.rpf (CitizenFX faux DLC)...");
        var dlcRpf = BuildDlcRpf(dlcName, streamingRpf);
        Console.WriteLine($"  {dlcRpf.Length} bytes");

        Console.WriteLine("Construyendo outer RPF (FiveM package)...");
        var outerRpf = BuildOuterRpf(weaponName, dlcName, dlcRpf);
        Console.WriteLine($"  {outerRpf.Length} bytes");

        string outPath = Path.Combine(Directory.GetCurrentDirectory(), weaponName + ".rpf");
        File.WriteAllBytes(outPath, outerRpf);
        Console.WriteLine($"\n RPF generado: {outPath}");
        Console.WriteLine($" Coloca este archivo en FiveM.app\\mods\\ y reinicia FiveM.");
    }

    static void ParseDdsHeader(byte[] dds, out int width, out int height)
    {
        height = BitConverter.ToInt32(dds, 12);
        width  = BitConverter.ToInt32(dds, 16);
    }

    static byte[] CompressToDxt5Dds(byte[] bgraPixels, int width, int height, bool bc3)
    {
        var rgba = new byte[bgraPixels.Length];
        for (int i = 0; i < bgraPixels.Length; i += 4)
        {
            rgba[i]   = bgraPixels[i + 2];
            rgba[i+1] = bgraPixels[i + 1];
            rgba[i+2] = bgraPixels[i];
            rgba[i+3] = bgraPixels[i + 3];
        }

        var encoder = new BcEncoder();
        encoder.OutputOptions.GenerateMipMaps = true;
        encoder.OutputOptions.MaxMipMapLevel  = -1;
        encoder.OutputOptions.Quality         = CompressionQuality.Balanced;
        encoder.OutputOptions.Format          = bc3 ? CompressionFormat.Bc3 : CompressionFormat.Bc1;

        IList<byte[]> mips = encoder.EncodeToRawBytes(rgba, width, height, PixelFormat.Rgba32);

        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);
        bw.Write(0x20534444u);
        bw.Write(124u);
        bw.Write(0x000A1007u);
        bw.Write((uint)height);
        bw.Write((uint)width);
        bw.Write((uint)mips[0].Length);
        bw.Write(0u);
        bw.Write((uint)mips.Count);
        for (int i = 0; i < 11; i++) bw.Write(0u);
        bw.Write(32u);
        bw.Write(4u);
        bw.Write(bc3 ? 0x35545844u : 0x31545844u);
        bw.Write(0u); bw.Write(0u); bw.Write(0u); bw.Write(0u); bw.Write(0u);
        bw.Write(0x00401008u);
        bw.Write(0u); bw.Write(0u); bw.Write(0u); bw.Write(0u);
        foreach (var mip in mips) bw.Write(mip);
        return ms.ToArray();
    }
}
