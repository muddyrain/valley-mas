# Blender Environment Check

检测时间：2026-09-22

## 结果

本机可以调用 Blender 5.2，且可以执行后台 Python 脚本。

| 项目 | 结果 |
| --- | --- |
| Launcher | `D:\Blender\blender-launcher.exe`，进程可启动并正常返回，但 `--version` 不输出版本文本 |
| 实际 Blender | `D:\Blender\blender.exe` |
| 版本 | Blender 5.2.1 LTS |
| 分支 / Hash | `blender-v5.2-release` / `9e2066aef7ef` |
| 平台 | Windows Release，x64 |
| `--background` | PASS，退出码 0 |
| Python 执行 | PASS，`bpy.app.version_string = 5.2.1 LTS`，`bpy.app.background = True` |

## 实际检查

### 可执行文件搜索

发现：

```text
D:\Blender\blender-launcher.exe
D:\Blender\blender.exe
```

未发现需要绕过 launcher 的其他 Blender executable；`D:\Blender\blender.exe` 已确认是可直接用于后台脚本和导出的实际引擎。

### 版本检查

```powershell
& 'D:\Blender\blender.exe' --version
```

关键输出：

```text
Blender 5.2.1 LTS
build branch: blender-v5.2-release
build hash: 9e2066aef7ef
build platform: Windows
build type: Release
```

### 后台模式检查

```powershell
& 'D:\Blender\blender.exe' --background --factory-startup --python-expr "import bpy; print('BLUE_HOUR_BACKGROUND_OK', bpy.app.background)"
```

结果：退出码 `0`，输出 `BLUE_HOUR_BACKGROUND_OK True`。

### Python 脚本执行检查

```powershell
& 'D:\Blender\blender.exe' --background --factory-startup --python-expr "import bpy; print('BLUE_HOUR_BPY_OK', bpy.app.version_string, bpy.app.background)"
```

结果：退出码 `0`，输出：

```text
BLUE_HOUR_BPY_OK 5.2.1 LTS True
```

## 结论

后续 Blender 批量资产生成应使用：

```text
D:\Blender\blender.exe
```

建议命令形态：

```powershell
& 'D:\Blender\blender.exe' --background --factory-startup --python apps/blue-hour/art/blender/generate.py -- --batch props
```

本次只执行环境检测，没有生成或修改任何资产。
