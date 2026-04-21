using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CameraFollowMouse : MonoBehaviour
{
  // 主要功能
  // 镜头跟随玩家移动 ，玩家在镜头中心
  // 鼠标向四周便宜，镜头也相应偏移
  public Transform target; // 目标

  public Vector3 cameraOffset = new Vector3(0, 0, -10); // 镜头偏移
  // Start is called before the first frame update
  void Awake()
  {
    target = GameObject.Find("Player").transform;
  }

  // Update is called once per frame
  void Update()
  {

  }

  void LateUpdate()
  {
    transform.position = target.position + new Vector3(0, 0, -10);
  }
}
