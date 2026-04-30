using System;
using System.IO;
using System.Reflection;
using CodeWalker.GameFiles;

class Program
{
    static void Main(string[] args)
    {
        try
        {
            Console.WriteLine("Loading GTA5 Keys directly from files...");
            
            // Just call LoadKeysFromPath, but we mock the Load file? No.
            // Let's use reflection to call the internal loading methods if possible.
            // Or just dump what keys CodeWalker needs!
            
            // Wait, GTA5Keys has: Load(byte[] aes, byte[] ng, byte[] hash, ...)
            // Does it? Let's check Methods of GTA5Keys!
            Type t = typeof(GTA5Keys);
            foreach (MethodInfo m in t.GetMethods(BindingFlags.Public | BindingFlags.Static))
            {
                Console.Write(m.Name + "(");
                ParameterInfo[] p = m.GetParameters();
                for (int i=0; i<p.Length; i++) {
                    Console.Write(p[i].ParameterType.Name + " " + p[i].Name);
                    if (i < p.Length - 1) Console.Write(", ");
                }
                Console.WriteLine(")");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.ToString());
        }
    }
}
