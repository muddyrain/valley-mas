#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace UnityClimber.EditorTools
{
    public static class ClimberAssetSwapEditor
    {
        private const string PlayerModelPeachPath = "Assets/Models/Characters/peach.glb";
        private const string PlayerModelDaisyPath = "Assets/Models/Characters/daisy.glb";

        [MenuItem("Tools/Unity Climber/Apply P4 First Asset Swap")]
        public static void ApplyP4FirstAssetSwap()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || !scene.path.EndsWith("Assets/Scenes/SampleScene.scene"))
            {
                Debug.LogError("[unity-climber] 请先打开 Assets/Scenes/SampleScene.scene");
                return;
            }

            ReplaceByName("Step_01", "Assets/Models/Setpieces/stepping_stone.glb");
            ReplaceByName("Step_02", "Assets/Models/Setpieces/rock_slab.glb");
            ReplaceByName("Step_03", "Assets/Models/Setpieces/plank_long.glb");
            ReplaceByName("FinishBuffer", "Assets/Models/Setpieces/container_short.glb");

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Debug.Log("[unity-climber] P4-02 首批模型替换已完成并保存。");
        }

        [MenuItem("Tools/Unity Climber/Apply Player Model/Peach")]
        public static void ApplyPlayerModelPeach()
        {
            ApplyPlayerModel(PlayerModelPeachPath, "PlayerVisual_Peach");
        }

        public static void ApplyPlayerModelPeachInSampleScene()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || string.IsNullOrEmpty(scene.path))
            {
                Debug.LogError("[unity-climber] 当前没有已打开场景，请先在编辑器里打开 SampleScene.scene。");
                return;
            }

            if (!scene.path.EndsWith("Assets/Scenes/SampleScene.scene") && !scene.path.EndsWith("Assets/Scenes/SampleScene.unity"))
            {
                Debug.LogError("[unity-climber] 当前场景不是 SampleScene.scene: " + scene.path);
                return;
            }

            ApplyPlayerModel(PlayerModelPeachPath, "PlayerVisual_Peach");
        }

        public static void ApplyPlayerModelPeachInSampleUnity()
        {
            var scene = EditorSceneManager.OpenScene("Assets/Scenes/SampleScene.unity", OpenSceneMode.Single);
            if (!scene.IsValid())
            {
                Debug.LogError("[unity-climber] 无法打开 Assets/Scenes/SampleScene.unity");
                return;
            }

            ApplyPlayerModel(PlayerModelPeachPath, "PlayerVisual_Peach");
        }

        [MenuItem("Tools/Unity Climber/Apply Player Model/Daisy")]
        public static void ApplyPlayerModelDaisy()
        {
            ApplyPlayerModel(PlayerModelDaisyPath, "PlayerVisual_Daisy");
        }

        private static void ApplyPlayerModel(string modelAssetPath, string visualName)
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || (!scene.path.EndsWith("Assets/Scenes/SampleScene.scene") && !scene.path.EndsWith("Assets/Scenes/SampleScene.unity")))
            {
                Debug.LogError("[unity-climber] 请先打开 Assets/Scenes/SampleScene.scene");
                return;
            }

            var player = GameObject.Find("Player");
            if (player == null)
            {
                Debug.LogError("[unity-climber] 场景内未找到 Player 对象。");
                return;
            }

            var modelAsset = AssetDatabase.LoadAssetAtPath<GameObject>(modelAssetPath);
            if (modelAsset == null)
            {
                Debug.LogError("[unity-climber] 角色模型未找到: " + modelAssetPath);
                return;
            }

            RemoveChildIfExists(player.transform, "PlayerVisual_Peach");
            RemoveChildIfExists(player.transform, "PlayerVisual_Daisy");
            RemoveChildIfExists(player.transform, "PlayerVisual");

            var visual = PrefabUtility.InstantiatePrefab(modelAsset, scene) as GameObject;
            if (visual == null)
            {
                Debug.LogError("[unity-climber] 角色模型实例化失败: " + modelAssetPath);
                return;
            }

            visual.name = visualName;
            visual.transform.SetParent(player.transform, false);
            visual.transform.localPosition = new Vector3(0f, -1f, 0f);
            visual.transform.localRotation = Quaternion.identity;
            visual.transform.localScale = Vector3.one;

            var playerMeshRenderer = player.GetComponent<MeshRenderer>();
            if (playerMeshRenderer != null)
            {
                playerMeshRenderer.enabled = false;
            }

            var playerMeshFilter = player.GetComponent<MeshFilter>();
            if (playerMeshFilter != null)
            {
                playerMeshFilter.sharedMesh = null;
            }

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Debug.Log("[unity-climber] Player 角色外观已替换并保存: " + visualName, player);
        }

        private static void RemoveChildIfExists(Transform parent, string childName)
        {
            var child = parent.Find(childName);
            if (child != null)
            {
                Object.DestroyImmediate(child.gameObject);
            }
        }

        private static void ReplaceByName(string sceneObjectName, string modelAssetPath)
        {
            var oldObject = GameObject.Find(sceneObjectName);
            if (oldObject == null)
            {
                Debug.LogWarning("[unity-climber] 场景对象不存在: " + sceneObjectName);
                return;
            }

            var modelAsset = AssetDatabase.LoadAssetAtPath<GameObject>(modelAssetPath);
            if (modelAsset == null)
            {
                Debug.LogWarning("[unity-climber] 模型未找到: " + modelAssetPath);
                return;
            }

            var oldPos = oldObject.transform.position;
            var oldRot = oldObject.transform.rotation;
            var oldScale = oldObject.transform.localScale;

            var instance = PrefabUtility.InstantiatePrefab(modelAsset, oldObject.scene) as GameObject;
            if (instance == null)
            {
                Debug.LogWarning("[unity-climber] 模型实例化失败: " + modelAssetPath);
                return;
            }

            instance.name = sceneObjectName;
            instance.transform.position = oldPos;
            instance.transform.rotation = oldRot;
            instance.transform.localScale = oldScale;

            EnsureCollision(instance);
            Object.DestroyImmediate(oldObject);
        }

        private static void EnsureCollision(GameObject root)
        {
            if (root.GetComponent<Collider>() != null || root.GetComponentInChildren<Collider>() != null)
            {
                return;
            }

            var renderer = root.GetComponentInChildren<Renderer>();
            if (renderer == null)
            {
                root.AddComponent<BoxCollider>();
                return;
            }

            var collider = root.AddComponent<BoxCollider>();
            var localCenter = root.transform.InverseTransformPoint(renderer.bounds.center);
            var localSize = renderer.bounds.size;
            collider.center = localCenter;
            collider.size = localSize;
        }
    }
}
#endif
