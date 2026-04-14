using UnityEngine;

namespace UnityClimber.Gameplay
{
    public sealed class ClimberFollowCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 offset = new Vector3(0f, 4.5f, -7f);
        [SerializeField] private float smoothTime = 0.1f;
        [SerializeField] private float lookHeight = 1.2f;

        private Vector3 _velocity;

        public void SetTarget(Transform nextTarget)
        {
            target = nextTarget;
        }

        public Vector3 GetOffset()
        {
            return offset;
        }

        public void SetOffset(Vector3 nextOffset)
        {
            offset = nextOffset;
        }

        private void LateUpdate()
        {
            if (target == null)
            {
                return;
            }

            // Keep camera offset in world space so A/S/D movement does not feel like
            // camera is being "twisted" around the character every frame.
            var desiredPosition = target.position + offset;
            transform.position = Vector3.SmoothDamp(transform.position, desiredPosition, ref _velocity, smoothTime);
            var lookTarget = target.position + Vector3.up * lookHeight;
            transform.LookAt(lookTarget);
        }
    }
}
