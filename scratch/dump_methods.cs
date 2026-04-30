using System;
using System.Reflection;
using CodeWalker.GameFiles;

class Program
{
    static void Main(string[] args)
    {
        Type t = typeof(RpfFile);
        Console.WriteLine("Methods of RpfFile:");
        foreach (MethodInfo m in t.GetMethods())
        {
            if (m.IsPublic) Console.WriteLine(" - " + m.Name);
        }
    }
}
