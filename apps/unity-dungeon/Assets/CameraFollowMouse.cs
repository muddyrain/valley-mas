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

  // 平滑移动速度
  public float smoothSpeed = 5f;
  // 镜头偏移的系数
  public float maxHouseOffset = 0.3f;
  // 最终镜头偏移量
  public Vector3 mouseOffsetFinal;
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
    // 跟随鼠标偏移
    FollowMouseOffset();

    // 镜头平滑移动
    transform.position =  Vector3.Lerp(transform.position,target.position + cameraOffset + mouseOffsetFinal,Time.deltaTime * smoothSpeed);
  }

  private void FollowMouseOffset()
  {
    // 拿到鼠标相对中心的偏移

    // 屏幕中心
    Vector3 screenCenter = new Vector3(Screen.width / 2f, Screen.height / 2f);
    // 拿到鼠标位置
    Vector3 mousePos = Input.mousePosition;
    // 鼠标相对屏幕中心偏移量
    Vector2 offsetMouse = new Vector2((mousePos.x - screenCenter.x) / (Screen.width / 2f), (mousePos.y - screenCenter.y) / (Screen.height / 2f));
    // 限制模长
    Vector2 offsetMouseNormal = Vector2.ClampMagnitude(offsetMouse, 1f);

    // 最终
    mouseOffsetFinal = maxHouseOffset * offsetMouseNormal;
  }
}
