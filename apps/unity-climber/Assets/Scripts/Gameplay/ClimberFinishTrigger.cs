using UnityEngine;

namespace UnityClimber.Gameplay
{
    public sealed class ClimberFinishTrigger : MonoBehaviour
    {
        private bool _finished;

        private void OnTriggerEnter(Collider other)
        {
            if (_finished)
            {
                return;
            }

            if (other.GetComponent<ClimberPlayerController>() == null)
            {
                return;
            }

            _finished = true;
            Debug.Log("[unity-climber] 登顶完成！你可以继续在这个基础上扩展关卡。", this);
        }
    }
}
