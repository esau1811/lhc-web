using System;
using System.IO;
using System.Runtime.InteropServices;

class Program {
    [DllImport("oo2core_5_win64.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int OodleLZ_Decompress(
        byte[] compBuf,
        int compBufSize,
        byte[] rawBuf,
        long rawLen,
        int fuzzSafe,
        int checkCRC,
        int verbosity,
        IntPtr decBufBase,
        long decBufSize,
        IntPtr fpCallback,
        IntPtr callbackUserData,
        IntPtr decoderMemory,
        long decoderMemorySize,
        int threadModule);

    static void Main(string[] args) {
        string inFile = "lmg.bin";
        int uncompressedSize = 55496;

        byte[] input = File.ReadAllBytes(inFile);
        byte[] output = new byte[uncompressedSize];
        
        for (int i = 0; i <= 3; i++) {
            Console.WriteLine("Trying with ThreadModule = " + i + ", offset 0...");
            int res = OodleLZ_Decompress(input, input.Length, output, uncompressedSize, 1, 0, 0, IntPtr.Zero, 0, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0, i);
            Console.WriteLine("Result: " + res);
            if (res > 0) {
                File.WriteAllBytes("lmg_out.awc", output);
                return;
            }
        }
    }
}
