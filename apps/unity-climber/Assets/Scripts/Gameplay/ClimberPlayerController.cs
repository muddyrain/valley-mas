using UnityEngine;

namespace UnityClimber.Gameplay
{
    [RequireComponent(typeof(Rigidbody), typeof(CapsuleCollider))]
    public sealed class ClimberPlayerController : MonoBehaviour
    {
        [Header("Move")]
        [SerializeField] private float moveSpeed = 6f;
        [SerializeField] private float acceleration = 20f;
        [SerializeField] private float rotationSpeed = 14f;

        [Header("Jump")]
        [SerializeField] private float jumpForce = 6.5f;
        [SerializeField] private LayerMask groundLayer = ~0;
        [SerializeField] private float groundCheckDistance = 0.2f;

        [Header("Respawn")]
        [SerializeField] private string checkpointObjectName = "Checkpoint_01";
        [SerializeField] private string startPlatformObjectName = "StartPlatform";
        [SerializeField] private string finishPlatformObjectName = "FinishPlatform";
        [SerializeField] private float fallRespawnY = -3f;
        [SerializeField] private Vector3 respawnOffset = new Vector3(0f, 1.2f, 0f);
        [SerializeField] private KeyCode restartKey = KeyCode.R;

        [Header("HUD")]
        [SerializeField] private bool hudEnabled = true;

        [Header("Tuning Panel")]
        [SerializeField] private bool tuningPanelEnabled = true;
        [SerializeField] private KeyCode tuningToggleKey = KeyCode.F2;

        private Rigidbody _rigidbody;
        private Camera _mainCamera;
        private CapsuleCollider _capsuleCollider;
        private Transform _checkpointTransform;
        private Transform _startPlatformTransform;
        private Transform _finishPlatformTransform;
        private ClimberFollowCamera _followCamera;
        private Vector3 _spawnPosition;
        private bool _showTuningPanel;
        private Rect _panelRect = new Rect(12f, 12f, 320f, 230f);

        private void Awake()
        {
            _rigidbody = GetComponent<Rigidbody>();
            _capsuleCollider = GetComponent<CapsuleCollider>();
            _mainCamera = Camera.main;

            _rigidbody.useGravity = true;
            _rigidbody.isKinematic = false;
            _rigidbody.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
            _rigidbody.interpolation = RigidbodyInterpolation.Interpolate;
            _spawnPosition = transform.position;
        }

        private void Start()
        {
            var checkpoint = GameObject.Find(checkpointObjectName);
            if (checkpoint != null)
            {
                _checkpointTransform = checkpoint.transform;
            }

            var startPlatform = GameObject.Find(startPlatformObjectName);
            if (startPlatform != null)
            {
                _startPlatformTransform = startPlatform.transform;
            }

            var finishPlatform = GameObject.Find(finishPlatformObjectName);
            if (finishPlatform != null)
            {
                _finishPlatformTransform = finishPlatform.transform;
            }

            if (_mainCamera != null)
            {
                _followCamera = _mainCamera.GetComponent<ClimberFollowCamera>();
            }
        }

        private void Update()
        {
            if ((Input.GetKeyDown(KeyCode.Space) || Input.GetButtonDown("Jump")) && IsGrounded())
            {
                _rigidbody.AddForce(Vector3.up * jumpForce, ForceMode.VelocityChange);
            }

            if (_checkpointTransform != null && transform.position.y < fallRespawnY)
            {
                RespawnToSafePoint();
            }

            if (tuningPanelEnabled && Input.GetKeyDown(tuningToggleKey))
            {
                _showTuningPanel = !_showTuningPanel;
            }

            if (Input.GetKeyDown(restartKey))
            {
                RespawnToSafePoint();
            }
        }

        private void FixedUpdate()
        {
            if (_mainCamera == null)
            {
                _mainCamera = Camera.main;
                if (_mainCamera == null)
                {
                    return;
                }
            }

            var input = ReadMoveInput();
            var cameraForward = _mainCamera.transform.forward;
            var cameraRight = _mainCamera.transform.right;
            cameraForward.y = 0f;
            cameraRight.y = 0f;
            cameraForward.Normalize();
            cameraRight.Normalize();

            var desiredDirection = (cameraForward * input.y + cameraRight * input.x).normalized;
            var currentVelocity = _rigidbody.velocity;
            var targetVelocity = desiredDirection * moveSpeed;
            var horizontalVelocity = Vector3.MoveTowards(
                new Vector3(currentVelocity.x, 0f, currentVelocity.z),
                targetVelocity,
                acceleration * Time.fixedDeltaTime
            );

            _rigidbody.velocity = new Vector3(horizontalVelocity.x, currentVelocity.y, horizontalVelocity.z);

            if (desiredDirection.sqrMagnitude > 0.01f)
            {
                var targetRotation = Quaternion.LookRotation(desiredDirection, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationSpeed * Time.fixedDeltaTime);
            }
        }

        private static Vector2 ReadMoveInput()
        {
            var keyX = 0f;
            var keyY = 0f;

            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow))
            {
                keyX -= 1f;
            }

            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow))
            {
                keyX += 1f;
            }

            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow))
            {
                keyY -= 1f;
            }

            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow))
            {
                keyY += 1f;
            }

            var keyInput = new Vector2(keyX, keyY);
            if (keyInput.sqrMagnitude > 0.001f)
            {
                return keyInput.normalized;
            }

            return new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        }

        private bool IsGrounded()
        {
            var bounds = _capsuleCollider.bounds;
            var radius = Mathf.Max(0.05f, bounds.extents.x * 0.8f);
            var castDistance = bounds.extents.y + groundCheckDistance;
            return Physics.SphereCast(
                bounds.center,
                radius,
                Vector3.down,
                out _,
                castDistance,
                groundLayer,
                QueryTriggerInteraction.Ignore
            );
        }

        private void RespawnToSafePoint()
        {
            if (_checkpointTransform != null)
            {
                transform.position = _checkpointTransform.position + respawnOffset;
            }
            else
            {
                transform.position = _spawnPosition;
            }

            _rigidbody.velocity = Vector3.zero;
            _rigidbody.angularVelocity = Vector3.zero;
        }

        private void OnGUI()
        {
            if (hudEnabled)
            {
                DrawHudPanel();
            }

            if (!tuningPanelEnabled || !_showTuningPanel)
            {
                return;
            }

            _panelRect = GUI.Window(1001, _panelRect, DrawTuningPanel, "Climber Tuning");
        }

        private void DrawTuningPanel(int windowId)
        {
            var y = 24f;

            GUI.Label(new Rect(12f, y, 180f, 20f), "Move Speed: " + moveSpeed.ToString("0.00"));
            moveSpeed = GUI.HorizontalSlider(new Rect(180f, y + 4f, 120f, 20f), moveSpeed, 2f, 14f);
            y += 34f;

            GUI.Label(new Rect(12f, y, 180f, 20f), "Jump Force: " + jumpForce.ToString("0.00"));
            jumpForce = GUI.HorizontalSlider(new Rect(180f, y + 4f, 120f, 20f), jumpForce, 3f, 14f);
            y += 34f;

            if (_followCamera != null)
            {
                var cameraOffset = _followCamera.GetOffset();

                GUI.Label(new Rect(12f, y, 180f, 20f), "Camera Height: " + cameraOffset.y.ToString("0.00"));
                cameraOffset.y = GUI.HorizontalSlider(new Rect(180f, y + 4f, 120f, 20f), cameraOffset.y, 2f, 10f);
                y += 34f;

                GUI.Label(new Rect(12f, y, 180f, 20f), "Camera Distance: " + cameraOffset.z.ToString("0.00"));
                cameraOffset.z = GUI.HorizontalSlider(new Rect(180f, y + 4f, 120f, 20f), cameraOffset.z, -14f, -3f);
                y += 34f;

                _followCamera.SetOffset(cameraOffset);
            }

            GUI.Label(new Rect(12f, y, 280f, 20f), "Toggle: " + tuningToggleKey + " | Jump: Space");
            GUI.DragWindow(new Rect(0f, 0f, 320f, 20f));
        }

        private void DrawHudPanel()
        {
            var panel = new Rect(12f, 12f, 300f, 96f);
            GUI.Box(panel, "Climber HUD");

            var currentHeight = transform.position.y;
            var progressPercent = GetProgressPercent();

            GUI.Label(new Rect(24f, 40f, 260f, 20f), "Height: " + currentHeight.ToString("0.00") + "m");
            GUI.Label(new Rect(24f, 60f, 260f, 20f), "Progress: " + progressPercent.ToString("0") + "%");
            GUI.Label(new Rect(24f, 80f, 260f, 20f), "Jump: Space  |  Restart: " + restartKey);
        }

        private float GetProgressPercent()
        {
            if (_startPlatformTransform == null || _finishPlatformTransform == null)
            {
                return 0f;
            }

            var startZ = _startPlatformTransform.position.z;
            var finishZ = _finishPlatformTransform.position.z;
            if (Mathf.Approximately(startZ, finishZ))
            {
                return 0f;
            }

            var progress01 = Mathf.InverseLerp(startZ, finishZ, transform.position.z);
            return Mathf.Clamp01(progress01) * 100f;
        }
    }
}
