using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Needle.Engine;

public static class ClubBuilder
{
    [Serializable] public class Source { public string unit; public Part[] meshes; }
    [Serializable] public class Part { public string name,zone; public float[] positions,normals,uv; public int[] triangles; public string color,texture; public float roughness; public bool dynamic; }
    const string ScenePath="Assets/Scenes/ReboteDeCristal.unity";
    [MenuItem("Rebote/1. Construir escena a escala")]
    public static void Build()
    {
        Directory.CreateDirectory("Assets/Scenes");Directory.CreateDirectory("Assets/Models");Directory.CreateDirectory("Assets/Materials");Directory.CreateDirectory("Assets/Textures");
        string source=Path.GetFullPath("../web/src/assets");
        foreach(var f in Directory.GetFiles(source,"*.png"))File.Copy(f,"Assets/Textures/"+Path.GetFileName(f),true);
        AssetDatabase.Refresh();
        var data=JsonUtility.FromJson<Source>(File.ReadAllText("Assets/Source/cancha.json"));
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var origin=new GameObject("CanteraUnity");var equipment=new GameObject("Equipo_visualizacion");
        var materials=new Dictionary<string,Material>();
        int i=0;
        foreach(var part in data.meshes)
        {
            var obj=new GameObject(part.name);obj.transform.SetParent(part.dynamic?equipment.transform:origin.transform,false);
            var mesh=new Mesh {name=part.name,indexFormat=IndexFormat.UInt32};
            var vertices=new Vector3[part.positions.Length/3];var normals=new Vector3[vertices.Length];var uv=new Vector2[vertices.Length];
            for(int j=0;j<vertices.Length;j++) { vertices[j]=new Vector3(part.positions[j*3],part.positions[j*3+1],-part.positions[j*3+2]); if(part.normals.Length>j*3+2)normals[j]=new Vector3(part.normals[j*3],part.normals[j*3+1],-part.normals[j*3+2]);if(part.uv.Length>j*2+1)uv[j]=new Vector2(part.uv[j*2],part.uv[j*2+1]); }
            var tris=(int[])part.triangles.Clone();for(int j=0;j<tris.Length;j+=3){int t=tris[j];tris[j]=tris[j+2];tris[j+2]=t;}
            mesh.vertices=vertices;mesh.triangles=tris;mesh.normals=normals;mesh.uv=uv;mesh.RecalculateBounds();
            if(!part.dynamic){var settings=new UnwrapParam();UnwrapParam.SetDefaults(out settings);settings.packMargin=.025f;Unwrapping.GenerateSecondaryUVSet(mesh,settings);}
            string meshPath=$"Assets/Models/{i:000}.asset";AssetDatabase.CreateAsset(mesh,AssetDatabase.GenerateUniqueAssetPath(meshPath));obj.AddComponent<MeshFilter>().sharedMesh=mesh;
            string key=part.color+part.texture;Material mat;
            if(!materials.TryGetValue(key,out mat)){
                mat=new Material(Shader.Find("Standard"));Color color;ColorUtility.TryParseHtmlString(part.color,out color);mat.color=color;mat.SetFloat("_Glossiness",1-part.roughness);
                if(part.texture=="fabric"){
                    var texPath="Assets/Textures/fabric-normal.png";var imp=AssetImporter.GetAtPath(texPath) as TextureImporter;imp.textureType=TextureImporterType.NormalMap;imp.SaveAndReimport();
                    mat.SetTexture("_BumpMap",AssetDatabase.LoadAssetAtPath<Texture2D>(texPath));mat.SetFloat("_BumpScale",.18f);mat.EnableKeyword("_NORMALMAP");mat.SetTexture("_OcclusionMap",AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Textures/fabric-ao.png"));
                }
                materials.Add(key,mat);AssetDatabase.CreateAsset(mat,$"Assets/Materials/Material{materials.Count:00}.mat");
            }
            var renderer=obj.AddComponent<MeshRenderer>();renderer.sharedMaterial=mat;
            if(!part.dynamic){GameObjectUtility.SetStaticEditorFlags(obj,StaticEditorFlags.ContributeGI|StaticEditorFlags.BatchingStatic|StaticEditorFlags.OccluderStatic);renderer.receiveGI=ReceiveGI.Lightmaps;renderer.scaleInLightmap=1;}
            i++;
        }
        var sun=new GameObject("Luz_horneada").AddComponent<Light>();sun.type=LightType.Directional;sun.lightmapBakeType=LightmapBakeType.Baked;sun.color=new Color(1,.85f,.65f);sun.intensity=1.7f;sun.transform.rotation=Quaternion.Euler(55,-35,0);sun.shadows=LightShadows.Soft;
        RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.34f,.36f,.46f);RenderSettings.ambientIntensity=1;
        var camera=new GameObject("Main Camera").AddComponent<Camera>();camera.tag="MainCamera";camera.transform.position=new Vector3(0,1.62f,-3.15f);camera.transform.LookAt(new Vector3(0,.91f,1));camera.fieldOfView=60;camera.nearClipPlane=.025f;camera.clearFlags=CameraClearFlags.SolidColor;Color bg;ColorUtility.TryParseHtmlString("#172238",out bg);camera.backgroundColor=bg;
        var exporter=new GameObject("Needle Engine").AddComponent<ExportInfo>();exporter.DirectoryName="../web";exporter.ExportOnSave=false;exporter.AutoCompress=false;exporter.CloudName="rebote-de-cristal";
        var lighting=new LightingSettings();lighting.name="Cantera_bake_CPU";lighting.lightmapper=LightingSettings.Lightmapper.ProgressiveCPU;lighting.bakedGI=true;lighting.realtimeGI=false;lighting.lightmapResolution=12;lighting.lightmapMaxSize=1024;lighting.lightmapPadding=4;lighting.directSampleCount=32;lighting.indirectSampleCount=64;lighting.environmentSampleCount=32;lighting.ao=true;lighting.aoMaxDistance=.8f;
        AssetDatabase.CreateAsset(lighting,"Assets/Scenes/CanteraLighting.lighting");Lightmapping.lightingSettings=lighting;
        EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),ScenePath);AssetDatabase.SaveAssets();
        Debug.Log("REBOTE_SCENE_OK meshes="+i+" mesa=2.74x1.525 top=.76 unit=m");
        if(Application.isBatchMode)EditorApplication.Exit(0);
    }
    [MenuItem("Rebote/2. Hornear iluminación")]
    public static void Bake()
    {
        var settingsType=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType("Needle.Engine.Utils.PlayerSettingsAccess")).FirstOrDefault(t=>t!=null);
        if(settingsType==null)settingsType=AppDomain.CurrentDomain.GetAssemblies().SelectMany(a=>a.GetTypes()).First(t=>t.Name=="PlayerSettingsAccess");
        settingsType.GetMethod("SetLightmapEncodingToNormalQuality").Invoke(null,null);
        EditorSceneManager.OpenScene(ScenePath);
        foreach(var renderer in GameObject.Find("CanteraUnity").GetComponentsInChildren<MeshRenderer>())if(renderer.name.Contains("Terraza_bake")){Color floorColor;ColorUtility.TryParseHtmlString("#42415F",out floorColor);renderer.sharedMaterial.color=floorColor;EditorUtility.SetDirty(renderer.sharedMaterial);}
        bool ok=Lightmapping.Bake();EditorSceneManager.SaveOpenScenes();AssetDatabase.SaveAssets();
        File.WriteAllText("../evidencias/unity-bake-result.json",JsonUtility.ToJson(new BakeResult {success=ok,lightmaps=LightmapSettings.lightmaps.Length,unity=Application.unityVersion,date=DateTime.UtcNow.ToString("o")}));
        Debug.Log("REBOTE_BAKE "+ok+" maps="+LightmapSettings.lightmaps.Length);
        if(Application.isBatchMode)EditorApplication.Exit(ok?0:1);
    }
    [Serializable] class BakeResult {public bool success;public int lightmaps;public string unity,date;}
    [MenuItem("Rebote/3. Exportar Needle y compilar")]
    public static async void Export()
    {
        EditorSceneManager.OpenScene(ScenePath);
        var origin=GameObject.Find("CanteraUnity");
        if(origin&&origin.transform.Find("Cantera_Entorno")==null){
            var source=JsonUtility.FromJson<Source>(File.ReadAllText("Assets/Source/cancha.json"));
            var parts=source.meshes.Where(p=>!p.dynamic).ToArray();var objects=origin.GetComponentsInChildren<MeshFilter>().Select(f=>f.transform).ToArray();
            var environment=new GameObject("Cantera_Entorno");environment.transform.SetParent(origin.transform,false);
            var architecture=new GameObject("Cancha_Arquitectura");architecture.transform.SetParent(origin.transform,false);
            for(int i=0;i<Math.Min(parts.Length,objects.Length);i++)objects[i].SetParent(parts[i].zone=="environment"?environment.transform:architecture.transform,true);
            EditorSceneManager.SaveOpenScenes();
        }
        var assemblies=AppDomain.CurrentDomain.GetAssemblies();
        var authentication=assemblies.Select(a=>a.GetType("Needle.Engine.Authentication")).First(t=>t!=null);
        var getUser=authentication.GetMethod("GetUserInformation",System.Reflection.BindingFlags.Static|System.Reflection.BindingFlags.NonPublic);
        await (System.Threading.Tasks.Task)getUser.Invoke(null,null);
        var check=assemblies.Select(a=>a.GetType("Needle.Engine.LicenseCheck")).First(t=>t!=null);
        await (System.Threading.Tasks.Task<bool>)check.GetMethod("QueryLicense").Invoke(null,new object[]{false});
        var type=AppDomain.CurrentDomain.GetAssemblies().Select(a=>a.GetType("Needle.Engine.Actions")).FirstOrDefault(t=>t!=null);
        if(type==null)throw new Exception("No se encontró el ensamblado Editor de Needle");
        var task=(System.Threading.Tasks.Task<bool>)type.GetMethod("ExportAndBuildDevelopment").Invoke(null,null);
        bool ok=await task;Debug.Log("REBOTE_EXPORT "+ok);
        File.WriteAllText("../evidencias/unity-export-result.txt",ok.ToString());
        if(ok)Capture();
        if(Application.isBatchMode)EditorApplication.Exit(ok?0:1);
    }
    public static void Capture()
    {
        EditorSceneManager.OpenScene(ScenePath);var camera=Camera.main;var rt=new RenderTexture(1440,900,24);camera.targetTexture=rt;camera.Render();RenderTexture.active=rt;var tex=new Texture2D(1440,900,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,1440,900),0,0);tex.Apply();File.WriteAllBytes("../evidencias/04-unity-escala.png",tex.EncodeToPNG());camera.targetTexture=null;RenderTexture.active=null;UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(tex);
        var atlas=new Texture2D(1024,1024,TextureFormat.RGB24,false);var pixels=Enumerable.Repeat(new Color(.09f,.13f,.21f),1024*1024).ToArray();atlas.SetPixels(pixels);
        foreach(var f in GameObject.Find("CanteraUnity").GetComponentsInChildren<MeshFilter>()){
            var renderer=f.GetComponent<MeshRenderer>();if(renderer.lightmapIndex!=0)continue;var uv=f.sharedMesh.uv2;var triangles=f.sharedMesh.triangles;var so=renderer.lightmapScaleOffset;
            for(int i=0;i<triangles.Length;i+=3)for(int e=0;e<3;e++){
                var a=uv[triangles[i+e]];var b=uv[triangles[i+(e+1)%3]];a=new Vector2((a.x*so.x+so.z)*1023,(a.y*so.y+so.w)*1023);b=new Vector2((b.x*so.x+so.z)*1023,(b.y*so.y+so.w)*1023);
                int steps=Math.Max(1,(int)Mathf.Max(Mathf.Abs(a.x-b.x),Mathf.Abs(a.y-b.y)));for(int k=0;k<=steps;k++){var p=Vector2.Lerp(a,b,k/(float)steps);atlas.SetPixel(Mathf.Clamp((int)p.x,0,1023),Mathf.Clamp((int)p.y,0,1023),new Color(.4f,.8f,.71f));}
            }
        }
        atlas.Apply();File.WriteAllBytes("../evidencias/uv2-atlas-unity.png",atlas.EncodeToPNG());UnityEngine.Object.DestroyImmediate(atlas);
    }
}
