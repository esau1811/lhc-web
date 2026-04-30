using System;
using System.Text;

class Program {
    public static uint CalculateHash(string str)
    {
        uint hash = 0;
        for (int i = 0; i < str.Length; i++)
        {
            char c = str[i];
            uint v = (uint)c;
            if (c == '\\') v = (uint)'/';
            else v = (uint)char.ToLowerInvariant(c);
            hash += v;
            hash += (hash << 10);
            hash ^= (hash >> 6);
        }
        hash += (hash << 3);
        hash ^= (hash >> 11);
        hash += (hash << 15);
        return hash;
    }

    static void Main() {
        string[] names = { "lmg_combat.awc", "ptl_pistol.awc", "smg_micro.awc" };
        uint[] sizes = { 55496, 64352, 193048 };
        for (int i = 0; i < names.Length; i++) {
            uint hash = CalculateHash(names[i]);
            uint keyidx = (hash + sizes[i] + 61) % 101;
            Console.WriteLine(names[i] + " hash=" + hash.ToString("x") + " keyIdx=" + keyidx);
        }
    }
}
