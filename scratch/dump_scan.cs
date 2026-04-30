using System;
using System.Reflection;
using CodeWalker.GameFiles;

class Program
{
    static void Main(string[] args)
    {
        Type t = typeof(RpfFile);
        foreach (MethodInfo m in t.GetMethods())
        {
            if (m.Name == "ScanStructure") {
                Console.Write("ScanStructure(");
                ParameterInfo[] p = m.GetParameters();
                for (int i=0; i<p.Length; i++) {
                    Console.Write(p[i].ParameterType.Name + " " + p[i].Name);
                    if (i < p.Length - 1) Console.Write(", ");
                }
                Console.WriteLine(")");
            }
        }
    }
}
