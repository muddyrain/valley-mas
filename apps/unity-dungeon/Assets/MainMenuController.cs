using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Playables;

public class MainMenuController : MonoBehaviour
{
  public bool IsEnterGame = false;  // 是否进入了主菜单
  public GameObject _splashScreen; // 启动画面的文字
  public PlayableDirector timeline; // Timeline 播放器
  // Start is called before the first frame update
  private void Awake()
  {
    _splashScreen = GameObject.Find("SplashScreen");
    timeline = GameObject.Find("Timeline").GetComponent<PlayableDirector>();  
  }

  // Update is called once per frame
  void Update()
  {
    if (Input.anyKeyDown && !IsEnterGame)
    {
      // 播放 timeline 动画 进入到主菜单
      timeline.Play();

      // 关闭启动画面文字
      _splashScreen.SetActive(false);

      // 标记已经进入主菜单
      IsEnterGame = true;
    }
  }
}
