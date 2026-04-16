using System.Collections;
using System.Collections.Generic;
using UnityEngine.SceneManagement;
using UnityEngine;

public class LoadingController : MonoBehaviour
{
  // Start is called before the first frame update
  void Start()
  {
    StartCoroutine(waitTow());
  }

  // Update is called once per frame
  void Update()
  {

  }


  IEnumerator waitTow()
  {
    yield return new WaitForSeconds(2f);

    // 2秒后切换到游戏主场景
    SceneManager.LoadScene(2);
  }
}
