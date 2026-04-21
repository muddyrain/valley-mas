using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerMovement : MonoBehaviour
{
  public float moveSpeed = 1f; // 移动速度
  public Rigidbody2D rb; // 玩家刚体
  public Vector2 movement; // 移动向量
  public GameObject _visual; // 玩家实体
  public Animator _animator; // 动画控制器

  void Awake()
  {
    rb = GetComponent<Rigidbody2D>();
    // 精准获取子物体
    _visual = transform.Find("PlayerVisual").gameObject;
    _animator = GetComponentInChildren<Animator>();
    // Optional: safety check
    if (_animator == null)
    {
      Debug.LogWarning("Animator not found in children of Player!");
    }
  }

  // Update is called once per frame
  void Update()
  {
    movement.x = Input.GetAxisRaw("Horizontal");
    movement.y = Input.GetAxisRaw("Vertical");

    // 防止对角线速度比直线快
    movement.Normalize();

    if (movement != Vector2.zero)
    {
      _animator.SetBool("isWalk", true);
    }
    else
    {
      _animator.SetBool("isWalk", false);
    }
  }

  private void FixedUpdate()
  {
    rb.MovePosition(rb.position + movement * moveSpeed * Time.fixedDeltaTime);
  }
}
