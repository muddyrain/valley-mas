# Valley Screen Recorder

Valley Screen Recorder 是 Valley MAS 中独立的 Windows/macOS 桌面截图与录屏应用。它使用 Electron、React、Vite 和 TypeScript，所有图像与录制数据只在本机处理，不上传服务端，也不依赖其他 Valley 应用。

## 第一阶段范围

- 托盘常驻：启动后不显示设置窗口，只驻留 Windows 系统托盘或 macOS 菜单栏；左键单击图标直接进入区域截图，右键菜单提供截图、录屏、快捷键设置、停止录制和退出。应用只允许一个进程实例；再次启动会静默退出新进程并唤起已有实例的控制台。
- 捕获模式栏：触发区域截图或录屏后，在选择层顶部显示“截图 / 录屏”，可不退出选择层直接切换模式。
- 截图：支持主显示器全屏截图，以及鼠标所在单显示器的区域截图；尚未开始拖拽时，选区层会随鼠标跨显示器切换并重新识别当前屏幕的客户端窗口。区域选择支持正向/反向拖拽、边缘裁剪、尺寸提示、选区外遮罩，右键或 `Esc` 取消。Windows 与 macOS 都会枚举当前可见顶层窗口，macOS 还会识别菜单栏背景、时间和第三方状态栏图标；鼠标悬停到微信等桌面客户端时预选其实际窗口边界，悬停到没有窗口或系统控件的桌面空白区域时回退为当前显示器全屏。轻点采用预选范围，继续拖拽则切回手动选区。窗口识别失败时同样回退为当前显示器全屏。
- 截图标注：选区确认后默认进入“移动选区”，拖拽期间选区边框、遮罩和当前桌面区域逐帧跟随，松开后才提交最终矩形并复用已捕获桌面图像，不会再次捕获造成闪屏；同时提供方框、圆框、箭头、画笔、连续马赛克、文字和吸色。工具条及样式弹层使用项目内的 shadcn 风格 Button/Tooltip 原语，每个工具均支持鼠标与键盘聚焦提示。方框、圆框、箭头、画笔复用同一颜色/粗细弹层，马赛克支持小/中/大三档像素块，已添加的文字可再次选择、拖动并切换小/中/大字号；吸色默认显示 HEX，按住 `Shift` 时临时切换为 RGB，松开恢复 HEX，单击会将当前显示的颜色值复制到剪贴板。工具条还可把最终图片固定为可拖动、可缩放、始终置顶的独立图片窗口；固定图片默认保留原选区位置，使用自定义关闭按钮，原生右键菜单提供复制、下载和关闭，图片本体带边框与不被窗口裁切的分层阴影。固定图片可以进入后续截图，捕获选区层仍始终显示在最上方。点击对号会同时写入 PNG 和系统剪贴板，“保存截图文件”通过系统文件对话框选择目标位置；另有撤销、长截图与取消入口。右键、`Esc` 或取消标注不生成文件。
- 丝滑交接：区域选择开始时预取显示器图像，标注画布在同一个透明窗口内隐藏预绘制；首帧就绪后用一次 React 状态切换原子替换选择层，不使用入场缩放动画，也不会在两个全屏窗口之间短暂露出桌面。
- 长截图：从当前选区开始，用户滚动目标内容时按固定选区连续采样；采集期间蓝色选区边框和选区外遮罩保持可见，采样不会反复隐藏、恢复捕获浮层。浮层只显示实时长图预览以及取消、完成按钮，整个浮层按右侧、左侧、下侧、上侧的顺序寻找选区外空间，全部放不下时才进入选区内右下角；右侧或左侧预览默认贴齐选区底边，内容增加时向上生长，达到选区高度或屏幕可用空间上限后内部可滚动并自动跟随最新内容，横向滚动条始终关闭，纵向只在滚动时短暂显示滑块，不显示轨道底座。拼接使用有上限的粗匹配加局部精确匹配，只保留每帧新增的像素行，避免长时间采集持续积压完整帧。点击完成只把整张长图复制到系统剪贴板并关闭浮层，不自动写入文件或再弹出结果窗口；取消按钮、右键或全局 `Esc` 取消时不产生结果，即使焦点仍在被截图应用也能直接关闭长截图。单张最大高度 30,000 像素，动态内容、视频、固定悬浮元素或缺少可识别重叠的页面可能无法正确拼接。
- 截图输出：默认写入系统 Pictures 目录下的 `Valley Screenshots`，PNG 文件名使用可排序本地时间，例如 `Valley-Screenshot-20260808-153045.png`；另存为路径只能由主进程原生文件对话框授权，Renderer 不能提交任意路径。
- 主显示器全屏录制：隐藏控制窗口后显示不进入成片的置顶边框、倒计时、录制时长和停止快捷键，默认以 WebM、30fps 录制。
- 单显示器区域录制：选择时保持选区内清晰、选区外遮罩；开始拖拽前可跟随鼠标切换目标显示器。确认后在轻量录屏设置面板后方继续显示当前选区蓝框和遮罩，选区可整体移动，也可通过八个控制点扩大或缩小；设置面板作为选择层子窗口并始终位于遮罩上方，顶部提供独立拖拽把手，使用 Lucide 图标并提供 WebM/MP4 格式选择，点击“开始录制”后才进入倒计时和正式录制。选区或设置阶段右键、`Esc` 均可取消且不产生文件。
- 录制格式：WebM 始终按 `MediaRecorder.isTypeSupported()` 降级选择 MIME；MP4 仅在当前 Chromium 原生支持 H.264/MP4 MediaRecorder 时可选，不伪装扩展名，也不引入 FFmpeg 转码。
- 录制媒体：Windows 默认按系统当前输出录制电脑声音，并提供 0%–100% 音量调节；Windows/macOS 均可选麦克风、摄像头画中画和是否录入鼠标。系统声音与麦克风同时启用时先用 Web Audio 合成为一条音轨，摄像头以右下角镜像圆角画中画叠加到最终视频。录屏设置面板打开后立即枚举摄像头和麦克风：检测期间先禁用并显示“检测中”，缺少设备时直接显示“未检测到设备”，不会等到点击开始才反馈；未启用的设备不会请求权限。
- 区域裁剪：捕获完整显示器，优先读取视频轨道实际宽高，将全局 DIP 选区换算为视频像素后逐帧绘制到 Canvas，再录制 `captureStream(30)`。
- 偏好设置：无原生 File/Edit 菜单，使用无边框现代标题栏；窗口默认高度会按当前工作区收敛，页面滚动不会带走标题栏和关闭按钮，窄屏需要滚动时不显示突兀的系统滚动条。可配置全局快捷键、开机自启动、系统通知和录屏保存位置。设置窗口本身不启用内容保护，因此第三方截图工具可以正常看到它；Valley 自己开始捕获时仍会先隐藏设置窗口。系统通知默认关闭，只有用户明确开启后才发送；Renderer 只能请求主进程打开原生目录选择框，不能提交任意保存路径。
- 快捷键：默认区域截图为 `Control+Alt+Shift+1`，区域录屏/停止为 `Control+Alt+Shift+2`，屏幕吸色为 `Control+Alt+Shift+3`；应用空闲时会在后台预热并复用隐藏的选择层，快捷键触发不再等待新窗口加载。设置窗口打开时三组捕获快捷键仍然有效，只有快捷键输入框正在录入组合键时才临时注销，避免把正在录入的组合键误当作截图命令。可从托盘打开设置窗口并按键修改，成功注册后持久化到本机用户数据目录。旧版已保存的截图/录屏组合键会保留，只补充吸色默认值；再次点击输入框、按 `Esc`、失焦或关闭设置都会退出录入并恢复快捷键。
- 停止入口：置顶悬浮控制条、托盘菜单或可配置全局快捷键；悬浮控制条可在倒计时取消、在录制中停止。
- 输出：默认写入系统 Videos 目录下的 `Valley Screen Recordings`，用户可在偏好设置中改为其他本机目录；文件名为可排序本地时间，例如 `Valley-Recording-20260808-153045.webm`。
- 完成后在屏幕右下角显示带完整路径的保存结果，可直接播放视频或打开所在文件夹；用户开启系统通知后，才额外通过 Windows 托盘气泡或 macOS 系统通知反馈。
- 品牌图标：应用窗口与打包 artifact 使用卡通小熊猫图标；macOS 菜单栏使用同一造型的单色线稿 Template 图标。

不包含 macOS 系统声音、暂停/恢复、GIF/FFmpeg 或 MP4 转码、视频编辑、上传、Web 唤起协议、自动更新、Mac App Store（MAS）提交，以及 Linux 适配。Electron 的桌面音频 loopback 当前只支持 Windows；macOS 系统声音若要落地，需要另行确认并引入原生捕获能力，当前不会伪装为可用。站外分发使用现有 DMG/ZIP，并支持 Developer ID Application 签名与 Apple notarization。

## 架构与安全

- 主进程：`electron/main.ts` 管理窗口、选择显示器、`desktopCapturer`、托盘、全局快捷键、开机自启动、捕获授权、原生目录/另存为对话框、保存目录和文件写入；长截图的后续帧捕获、重叠检测与拼接也留在主进程，macOS 14 及以上通过随应用构建的 ScreenCaptureKit helper 排除选区遮罩和预览窗口后采样。
- Preload：`electron/preload.ts` 仅暴露 `src/shared/contracts.ts` 定义的截图与录屏接口。
- Renderer：`src/App.tsx` 只管理快捷键设置；`src/SelectionOverlay.tsx`、`src/ScreenshotEditor.tsx` 和 `src/RecordingSetup.tsx` 管理捕获浮层；`src/renderer/recorder-runtime.ts` 使用 `getDisplayMedia`、Canvas 和 MediaRecorder；均不访问 Node 文件系统。
- 选择层：`src/SelectionOverlay.tsx` 的截图与录屏入口共用 `src/core/selection-controller.ts` 手势控制器；Renderer 只返回经过主进程再次校验的显示器内 DIP 矩形。主进程在空闲状态维护一个已加载但隐藏的选择层，收到 Renderer 首帧就绪信号后才显示，并在一次捕获结束后异步补充下一窗口。Windows 使用应用生命周期内预热的只读 Win32 查询进程，macOS 使用随应用打包的 CoreGraphics 查询 helper；两者统一换算为当前显示器 DIP。选择层立即读取上次有效缓存、后台无阻塞刷新，候选到达后会按鼠标最后停留位置直接吸附；Renderer 不能提交或执行命令，查询失败时自动退化为手动选区。
- 所有 BrowserWindow 启用上下文隔离和 sandbox、关闭 Node 集成、拒绝新窗口，并对控制窗口、选择层、录制状态提示层和悬浮控制条启用内容保护；macOS 14 及以上的长截图浮层改由 ScreenCaptureKit 捕获过滤器按窗口 ID 显式排除，避免新系统忽略内容保护后捕获到浮层自身。
- 主进程只接受固定 IPC channel、已知窗口来源、白名单 MIME、当前会话 ID、合法快捷键和有限大小数据块；Renderer 不能指定路径或执行命令。
- 录制期间先写入 `.part-*` 临时文件；只有非空录制完成后才按实际 MIME 原子重命名为 `.webm` 或 `.mp4`，失败时删除临时文件。
- 截图使用 `desktopCapturer` 返回图像的真实像素尺寸换算 DIP 选区，先写入随机 `.part-*` 临时文件，再原子重命名为 `.png`。

## 开发与构建

仓库根目录执行：

```bash
pnpm install
pnpm --filter @valley/screen-recorder dev
pnpm --filter @valley/screen-recorder typecheck
pnpm --filter @valley/screen-recorder check
pnpm --filter @valley/screen-recorder test
pnpm --filter @valley/screen-recorder build
pnpm --filter @valley/screen-recorder package:dir
pnpm --filter @valley/screen-recorder package:win
pnpm --filter @valley/screen-recorder package:mac
pnpm --filter @valley/screen-recorder package:mac:release
pnpm --filter @valley/screen-recorder runtime:probe-video -- "C:\\path\\recording.webm" 400 300 audio
```

开发模式使用 `http://127.0.0.1:5179`；生产构建只加载打包后的本地 `dist/index.html`。`package:dir` 生成当前平台的 unpacked artifact；`package:win` 必须在 Windows 执行并生成 x64 NSIS 安装程序，使用 7z 载荷并关闭当前不使用的差分更新包，同时只打包 `zh-CN` 与 `en-US` 两个 Electron 语言包。React 与 Lucide 只作为构建期依赖，最终应用不重复携带已被 Vite 打包的源码和 Source Map。当前实测安装包约 78.84 MiB、unpacked 约 302.48 MiB、`app.asar` 约 0.60 MiB；主要体积来自 Electron/Chromium，而非约 256 KiB 的 Renderer 业务 bundle。7z 构建压缩较慢，但下载体积和安装写入量显著低于 ZIP 载荷；安装器自身无法报告连续、真实的解压百分比，因此仍可能阶段性停留后跳进度。`package:mac` 必须在 macOS 执行，先生成同时支持 Intel 与 Apple Silicon 的窗口查询 helper，再生成 x64/arm64 的 DMG 与 ZIP；没有签名证书时只生成明确标记的 ad-hoc 本地测试包。`package:mac:release` 是站外正式发布入口，强制 Developer ID、Hardened Runtime、notarization 和 stapled ticket 验证，任一条件缺失都会失败。跨平台脚本会直接拒绝在错误宿主上打包，避免产生未经验证的伪 artifact。`runtime:probe-video` 使用项目已有 Electron/Chromium 解码指定文件，验证可播放性、可选宽高，并可用末尾 `audio` 断言音轨，不依赖 FFmpeg。

### macOS 正式分发

正式发布需要有效的 Apple Developer Program 会员、`Developer ID Application` 证书和 notarization 凭据。本机钥匙串已经安装证书时无需导出；CI 可通过 `CSC_LINK` 指向 `.p12` 文件或其 Base64 内容，并通过 `CSC_KEY_PASSWORD` 提供密码。notarization 推荐使用 App Store Connect API Key：

```bash
export CSC_LINK="/secure/path/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="<p12-password>"
export APPLE_API_KEY="/secure/path/AuthKey_<KEY_ID>.p8"
export APPLE_API_KEY_ID="<KEY_ID>"
export APPLE_API_ISSUER="<ISSUER_UUID>"
pnpm --filter @valley/screen-recorder package:mac:release
```

也可使用 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`，或使用 `APPLE_KEYCHAIN`、`APPLE_KEYCHAIN_PROFILE` 引用 `xcrun notarytool store-credentials` 保存的 profile。真实值只进入本机钥匙串、CI Secrets 或进程环境，不能写入仓库。正式命令完成后会对 x64 与 arm64 `.app` 依次执行严格 `codesign` 校验、Gatekeeper `spctl` 评估和 `xcrun stapler validate`；仅当全部通过时才视为可发布。

## 权限与平台限制

- Windows 可能通过隐私设置或系统策略拒绝屏幕捕获；应用会显示明确错误且不保留截图或有效视频文件。
- macOS 被动启动时只读取权限状态，不主动请求屏幕录制权限或预热窗口查询；首次触发截图/录屏或主动点击“请求权限”时才发起一次系统授权，同一时刻的重复请求会合并。系统已记录允许或拒绝后不会重复弹出首次确认框。通过“隐私与安全性”更改权限后必须完全重启应用。摄像头和麦克风说明已写入打包应用的 `Info.plist`。
- macOS 不提供系统声音选项；Windows 系统声音使用 Electron 的 loopback 捕获。麦克风或摄像头不存在、被占用或被拒绝时不会退化为静默成功。
- 全局快捷键可能被其他应用占用；新组合键注册失败时保留原设置并在界面显示错误。
- Pictures 或 Videos 目录不可写、磁盘错误或写入失败时会进入错误状态，清理临时文件并通过托盘通知提示。
- 第一版区域只能位于一个显示器内。显示器可位于虚拟桌面负坐标；换算以 `track.getSettings()` 的实际视频宽高为优先，DPI `scaleFactor` 仅作兜底。
- Windows NSIS 未签名，可能出现 SmartScreen 提示。普通 `package:mac` 会优先使用钥匙串、`CSC_NAME` 或 `CSC_LINK` 中的签名身份；没有有效证书时回退到 `com.valley.screenrecorder` 的 ad-hoc 本地测试签名，并关闭只适用于正式签名的 Hardened Runtime 与 notarization。ad-hoc 签名不受 Gatekeeper 信任，代码变化后也可能需要重新添加录屏权限。正式 `package:mac:release` 只接受 Developer ID Application 身份，启用 Hardened Runtime，携带 Electron JIT、麦克风和摄像头所需 entitlements，并要求 Apple notarization 成功。

## Windows 运行时验收

1. 启动后确认设置窗口不显示、系统托盘图标存在；左键单击托盘图标应直接进入区域截图，右键应只打开菜单；菜单可打开偏好设置并退出。确认窗口没有 File/Edit 原生菜单，系统通知默认关闭；分别修改截图、录屏与吸色快捷键并确认输入时应用不会隐藏，再次点击输入框或按 `Esc` 可取消高亮，重启后快捷键仍保留。分别切换开机自启动并重登系统验证，选择新的录屏保存目录后重启应用，确认目录仍保留且下一段视频写入新目录。
2. 触发截图快捷键，确认顶部第一个标签为“截图”且默认选中，第二个标签为“录屏”，并可在两个模式间来回切换。保持应用运行时再次双击安装后的应用，确认没有第二个进程或提示框，而是直接打开已有控制台。
3. 将鼠标移动到微信或其他可见桌面客户端，确认选区自动吸附窗口边界；多显示器环境下在未拖拽时把鼠标移到另一块屏幕，确认选区层跟随切换并能识别副屏客户端，拖拽期间则不会跳屏。轻点采用窗口边界，拖拽则改为手动选区。确认选区内保持清晰、其他区域显示遮罩，并出现标注工具条；键盘聚焦或短暂停留任一工具应出现 Tooltip。确认默认工具为“移动选区”，拖动后选区位置变化但尺寸和画面没有闪烁。分别检查方框/圆框/箭头/画笔的共享颜色与粗细弹层、马赛克三档大小、文字三档字号和撤销，再拖动并放大已添加的文字，确认最终图片使用新位置和字号。选择“吸色”，确认默认显示 HEX；按住 `Shift` 时切换为 RGB，松开恢复 HEX，分别单击并确认当前显示值写入系统剪贴板；再通过全局吸色快捷键复验整个屏幕。点击“固定截图”后确认图片默认停留在原选区位置，可拖动、缩放并保持在其他窗口上方；右键菜单依次验证复制、下载和关闭，再保留一张固定图片发起新截图，确认固定图片进入捕获画面且选区层仍在最上方。确认选择层到标注器没有露出桌面、闪白或缩放跳变；点击对号后确认 PNG 只包含选区、宽高符合 DIP 到截图实际像素比例，且图像已经进入系统剪贴板。
4. 再次截图并点击“保存截图文件”，确认系统另存为对话框出现、取消对话框后编辑器仍保留、选择目标路径后生成有效 PNG。点击“长截图”，确认滚动期间选区边框和选区外遮罩始终稳定、不随定时采样闪烁；浮层仅包含长图预览、取消和完成按钮，并按右、左、下、上的顺序优先留在选区外，空间不足时才进入选区内右下角。继续滚动直到预览超过可视高度，确认横向滚动条不出现，纵向仅在滚动时显示滑块且空闲后隐藏，预览自动跟随最新内容；保持焦点在被截图应用并按 `Esc`，确认长截图和浮层直接关闭。再次长截图并点击完成后确认浮层关闭、没有生成新文件，并可把系统剪贴板中的长图粘贴到图像应用，粘贴结果高度大于原选区。另一次通过按钮或右键取消并确认剪贴板和文件均不产生新结果。
5. 在选区或标注阶段按右键或 `Esc`，确认不会闪现 `0 × 0`，随后返回 idle 且不新增 PNG 或 `.part-*`；通过托盘发起全屏截图时确认 PNG 像素尺寸与主显示器捕获结果一致。
6. 切换到“录屏”并确认选区，检查录屏设置面板出现时仍能看到所选区域蓝框和选区外遮罩，而且面板没有被遮罩压暗或挡住；拖动选区及八个控制点，确认可移动、扩大和缩小，四边中点与边框精确居中；在选区和设置阶段分别右键取消，确认返回 idle 且不生成视频。拔除或禁用摄像头后打开设置面板，确认摄像头在检测期间不可点击且随后直接显示“未检测到设备”。分别选择 WebM 与可用时的 MP4，验证 Windows 系统声音默认开启且音量为 100%，再依次验证音量调节、麦克风、摄像头画中画及鼠标开关；录制约 5 秒后通过快捷键或悬浮控制条停止，确认画面只包含调整后选区，提示层未进入成片，所选音轨/画中画/鼠标状态与设置一致，且完成弹窗的播放和打开所在文件夹入口可用。全屏录制另需确认选择/提示层覆盖任务栏，红色边框四边均可见。
7. 快速重复点击开始；确认只产生一个捕获会话和一个文件，并检查截图或成片中没有持续出现主窗口、选择层或控制层。
8. 分别验证权限拒绝、快捷键冲突，以及 Pictures/Videos 目录写入失败时的可见错误。

## macOS 发布验收

在 Intel 与 Apple Silicon macOS 主机分别执行 `pnpm --filter @valley/screen-recorder package:mac`，安装对应 DMG 后复验托盘菜单、屏幕授权、截图、长截图、WebM/可用时的 MP4、麦克风、摄像头、鼠标开关、快捷键和错误提示。首次无权限启动时确认不会自动弹框，首次触发捕获时只出现一次授权请求；再确认菜单栏背景、时间、第三方状态图标可独立预选，桌面空白处回退为当前显示器全屏。固定一张截图后确认图片保持原选区位置，原生右键菜单中的复制、下载和关闭均可用；保留固定图片再次截图，确认图片进入捕获画面且选择层在它上方。正式发布前必须改用 `package:mac:release`，并确认输出显示两种架构的 Developer ID、Gatekeeper 与 stapler 验证均通过。同一 bundle ID、Team ID 和签名要求保持稳定时，后续升级通常可以沿用已有 TCC 授权；更换 Team、证书体系或 bundle ID 后必须重新验权。ad-hoc 签名的 CDHash 会随重新构建而变化，没有证书时，新构建若未自动出现在“录屏与系统录音”列表中，应通过列表下方的“+”重新选择 `/Applications/Valley Screen Recorder.app`。不要把 `tccutil reset ScreenCapture` 作为常规升级步骤：macOS 删除权限条目后可能需要重启系统，原生请求才能再次弹框。Windows 主机无法生成或运行 `.app`/DMG，macOS artifact 与运行时结论必须以对应 macOS 主机结果为准。
