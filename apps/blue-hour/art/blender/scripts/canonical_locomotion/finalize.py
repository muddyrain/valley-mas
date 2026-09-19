"""Build review evidence and an explicit production verdict from measured outputs."""
from pathlib import Path
import json,hashlib,html
import numpy as np
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent;APP=P.parents[1]
q=json.loads((P/'canonical-qa.json').read_text());d=json.loads((P/'dual-qa.json').read_text());v=json.loads((P/'conversion-verification.json').read_text());gate=json.loads((P/'canonical-gate.json').read_text());protection=json.loads((P/'protection-result.json').read_text())
raw=json.loads((P/'evidence/dual-runtime-samples.json').read_text())
a,b=[raw['characters'][x] for x in ['xia_zhiyao','su_wanxing']]
motion_diff=max(float(np.max(abs(np.array([s['poses'] for s in a['clips'][n]['samples']])-np.array([s['poses'] for s in b['clips'][n]['samples']])))) for n in a['clips'])
assert motion_diff==0 and raw['shared_library_instance'] and not raw['failures']
media=json.loads((P/'canonical-media.json').read_text())+json.loads((P/'dual-media.json').read_text())
assert len(media)==36 and all((P/m['path']).exists() for m in media)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
for cid in ['xia_zhiyao','su_wanxing']:
    for clip in ['public_idle','public_walking','public_running']:
        for view in ['upper_front','upper_back','upper_side','feet_side']:
            folder=P/'evidence'/cid/clip/'details';sheet=Image.new('RGB',(1440,800),'#17202b');draw=ImageDraw.Draw(sheet)
            for j in range(8):
                im=Image.open(folder/f'{view}_{j:02}.png').convert('RGB').resize((360,360));x=j%4*360;y=j//4*400
                sheet.paste(im,(x,y+40));draw.text((x+8,y+8),f'{cid} {clip} | {j}/8',font=font,fill='white')
            sheet.save(folder/(view+'_sheet.jpg'),quality=92)
def f(x):return f'{x:.3f}'
def rg(x):return f'{x[0]:.2f}–{x[1]:.2f}'
lines=['# Canonical Public Locomotion Library V1 验收报告','',
'**结论：公共源转换完成，canonical 技术与参考鞋底 QA 通过；Xia / Su 动态蒙皮验收 FAIL，尚未达到全部 Unified Survivor 共用的生产标准。**','',
'已生成唯一 `public_idle / public_walking / public_running` 和引用它们的公共库。已完成两角色原生播放、36 段视频、接地/滑动/Loop 测量与独立 Windows 程序。没有修补旧公共库，没有生成角色专属动作，没有接入 Gameplay。','',
'## 资源与来源','',
'新增资源目录：`assets/animations/public_locomotion/`。这是未接入 Runtime 的公共候选；不要因资源已输出就把双角色状态标为 PASS。','',
'- [公共库](../../assets/animations/public_locomotion/public_locomotion.tres)','- [public_idle](../../assets/animations/public_locomotion/public_idle.tres)','- [public_walking](../../assets/animations/public_locomotion/public_walking.tres)','- [public_running](../../assets/animations/public_locomotion/public_running.tres)','- [离线复现工具](../../art/blender/scripts/canonical_locomotion/reproduce.ps1)','- [全部视频](index.html)','- [独立 Windows 验收程序](build/CanonicalLocomotionReview.exe)','',
'三动作唯一输入是正式 Standard `.tres`；源 FBX 只用于读取 Skeleton Rest 与原 Mesh/Skin 接触参考，自带动画不作为动作输入。采样/Bake 为 120Hz，原时间轴 step=1/24s。','',
'| 输出 | 时长 s | 步频 steps/min | 唯一 Standard 源 SHA-256 |','|---|---:|---:|---|']
for n,c in q['clips'].items():lines.append(f'| public_{n} | {c["duration"]:.9f} | {c["cadence"]:.1f} | `{v["clips"][n]["source_sha256"]}` |')
lines+=['','两个 AnimationPlayer 使用同一 AnimationLibrary 与同一组 Animation 实例。120Hz 下两角色全部骨骼播放矩阵的最大差为 **0**。公共库只有三条外部资源引用，没有内嵌第二份动画，也没有 Xia/Su 命名的副本。','',
'## Source → Canonical 映射','',
'| Source | Canonical | Canonical parent |','|---|---|---|']
for row in v['source_to_canonical']:lines.append(f'| {row["source"] or "无，保持固定"} | {row["canonical"]} | {row["canonical_parent"] or "—"} |')
lines+=['','未映射源骨：'+', '.join('`'+x+'`' for x in v['ignored_source_bones'])+'。没有为末端骨增加 canonical 骨骼或动画轨道。','',
'## Rest-space 与统一 Authoring Reference','',
'所有计算先统一为 Godot 米制坐标，源旋转用极分解剥离 FBX 的 100 倍变换。设源世界 Rest 旋转为 Rs0、源动画旋转为 Rs(t)、canonical Rest 为 Rc0：','',
'```text\nD(t) = Rs(t) · inverse(Rs0)\nRcanonical(t) = D(t) · A · Rc0\nLocal(t) = inverse(Rcanonical_parent(t)) · Rcanonical(t)\n```','',
'`A` 是一次公共的解剖参考姿态对齐，不是任何角色的补偿。Spine/Head 使用单位 A；Shoulder/UpperArm/LowerArm 用源 Rest 的解剖骨段方向与 canonical Rest 骨段方向求 A；Hand 使用源 Hand Rest 轴。具体矩阵保存在 [authoring-reference.json](authoring-reference.json)。','',
'**为什么不能只做 D·Rc0：**源网格/骨架为 A Pose，canonical 骨架为 T Pose。只有轴增量会把中立手臂保留在外展位置，Standard Run 的屈肘方向也会改变。上述公共参考姿态把这个静态姿态差烘焙进动画键，未改任何 Skeleton Rest；这不同于把 absolute local rotation 直接拷过去。源 Rest 输入对应的是 canonical 上的公共 Authoring Pose，不能把它误称为输出 T Rest。','',
'最终 canonical 上，上臂与前臂的世界骨段方向逐帧匹配源动作，最大方向误差 **0.000122°**；上半身旋转增量经独立公式复算。没有重新设计 Arms、Head、Spine 或节奏。','',
'Hips 用左右髋关节中点转移，避免两个 Hips 原点的解剖含义不同。腿链比例为 **0.884744294**。脚部使用独立 canonical 鞋底参考（Y=0、宽80mm、后跟Z=-65mm、Toe铰点Z=115mm、前端Z=195mm），用源 Heel→Forefoot 三维方向、接触高度与按腿长比例缩放的水平轨迹进行离线双骨 IK；保留源膝弯曲平面。该参考不是 Xia 或 Su 的鞋网格。','',
'腿长、骨轴、Rest、Root、对象变换不变；唯一位置轨道是 Hips。Walking 为可达性产生 -4.122～0mm 的公共 Hips 垂直适配，Idle/Run 无额外 Hips 下移。输出每动作 23 个 rotation 轨道 + 1 个 Hips position 轨道，无 Scale、Runtime IK、Runtime Retarget 或 CrossFade 依赖。','',
'## Canonical QA','',
'canonical GLB 来自冻结 `create_rig()`，不传角色 landmarks。与两候选逐骨比较名称、父层级、local/global Rest 完全一致。参考鞋底是诊断用几何，不替代真实鞋底验收。','',
'| 动作 | Heel flat mm 左 / 右 | Forefoot flat mm 左 / 右 | 推荐局部支撑速度 m/s | 平脚预测残滑 mm 左 / 右 | 双脚高于3mm |','|---|---|---|---:|---|---:|']
for n,c in q['clips'].items():
    feet=c['canonical'];l=feet['Left'];r=feet['Right']
    lines.append(f'| {n} | {rg(l["heel_flat_mm"])} / {rg(r["heel_flat_mm"])} | {rg(l["forefoot_flat_mm"])} / {rg(r["forefoot_flat_mm"])} | {feet["mean_support_speed_m_s"]:.6f} | {f(l["flat_residual_at_shared_speed_mm"])} / {f(r["flat_residual_at_shared_speed_mm"])} | {feet["flight_fraction_3mm"]*100:.1f}% |')
lines+=['','Walking / Running 的 Landing heel 约1.50mm；Walking Push Off forefoot 约1.50mm，Running 左约1.50mm、右1.50～6.16mm。Heel Strike、平脚、后跟抬起、前掌最后支撑、Swing 保留；Run 的 20% 低腾空保留。没有全周期 Foot Lock。','',
'| 动作 | Knee flexion 左 / 右 ° | 120Hz 最大膝角变化 左 / 右 ° | Hips XYZ 范围 mm |','|---|---|---|---|']
for n,c in q['clips'].items():lines.append(f'| {n} | {rg(c["knee"]["Left"]["range_deg"])} / {rg(c["knee"]["Right"]["range_deg"])} | {f(c["knee"]["Left"]["max_120Hz_step_deg"])} / {f(c["knee"]["Right"]["max_120Hz_step_deg"])} | '+', '.join(f(x) for x in c['hips_xyz_range_mm'])+' |')
lines+=['','数值无膝反折、无骨段伸缩。比例适配不是零差异：Walking 最大膝弯曲约95.8°，源为约79°；Running 最大约116.9°，源约110.1°。这是较短 canonical 腿链与不同脚踝/鞋底基准的代价，不能声称所有腿部角度保持原值。最终运动风格仍需视觉签收。','',
'三动作存储首尾位置差均0mm，旋转差仅浮点量级（<0.00001°）。有限差分并非严格 C1：Foot 接缝速度差 Idle 最大约0.002m/s、Walk约0.161m/s、Run约0.181m/s；Head/Arms/Hips 连续，没有 CrossFade。完整各骨数据见 [canonical-qa.json](canonical-qa.json)。','',
'## Xia / Su 实际蒙皮 QA','',
'**两角色均 FAIL。**冻结 T Pose 骨架的关节中心与 A Pose 网格的实际手臂位置不一致。公共动画在正确恢复 Standard 手臂方向后，候选袖子/手臂/手又进入躯干，部分手被髋部/裙摆遮住。不能通过把公共上臂重新外展来宣称修好，否则会再次改变动作真源。下一步需要审计并修正统一 Bind Pose / Skin Alignment；本轮没有修改它们。','',
'| 角色 | 动作 | Heel flat mm 左 / 右 | Forefoot flat mm 左 / 右 | 平脚残滑 mm 左 / 右（公共速度） |','|---|---|---|---|---|']
for cid,c in d['characters'].items():
    for n,m in c['clips'].items():
        l=m['contact']['Left'];r=m['contact']['Right']
        lines.append(f'| {cid} | {n} | {rg(l["heel_flat_mm"])} / {rg(r["heel_flat_mm"])} | {rg(l["forefoot_flat_mm"])} / {rg(r["forefoot_flat_mm"])} | {f(l["flat_residual_at_canonical_speed_mm"])} / {f(r["flat_residual_at_canonical_speed_mm"])} |')
lines+=['','脚底平脚支撑大体正常，最小高度为正，未检测到该鞋底选区穿地；Idle 残余变化约2.4～3.0mm。Walking 平脚残滑约1.77～2.18mm，Running约0.75～1.83mm。这里是原地轨迹叠加参考恒速的预测，不是 Gameplay 实测。未应用2.8m/s候选。','',
'仍有脚滚动适配问题：真实鞋前掌在 Walking Push Off 区间最高约17.7～20.6mm，Running约17.3～21.9mm；诊断参考鞋底此时仍接近地面。说明鞋型、鞋蒙皮与统一 Toe/Foot 支点之间仍有差异。不能把末段腾空全解释为正常 Push Off，也不能拿 proxy 接地替代两角色接地。','',
'3mm阈值对实际鞋底过严：平脚正常间隙可达7.4mm，因此真实鞋底“两脚高于3mm”的比例包含鞋底间隙，不能直接当作跑步腾空比例。本文20%腾空指 canonical 同口径参考面。','',
'| 角色 | 动作 | 肩/腋/袖区域 edge ratio P99 | 最坏局部 edge ratio | 超2倍边数量峰值 |','|---|---|---:|---:|---:|']
for cid,c in d['characters'].items():
    for n,m in c['clips'].items():
        z=m['deformation']['shoulder_armpit_sleeve'];lines.append(f'| {cid} | {n} | {z["p99_stretch"]:.3f} | {z["max_stretch"]:.3f} | {z["max_edges_over_2x"]} |')
lines+=['','这些是 Rest 长度≥2mm 的三角边形变指标，区域按空间分区，并非整件衣服的拉伸倍数；没有把它们当作完整自相交检测。截图直接确认袖臂进入躯干，故不依赖数值阈值作 FAIL 判断。','',
'下半身未观察到膝反折或骨段拉长；裙/短裤随腿变形，鞋帮和踝部有蒙皮应变，仍需与接触残差一起修订绑定。手臂被遮蔽使 Wrist/Hand 姿态无法通过。长发缺少动态摆动不计失败；抽帧未见整束头发被手臂带走，但肩颈交叠区域不能整体签 PASS。没有增加发骨、布料或额外骨骼。','',
'## 视频与静态证据','',
'所有视频为 Godot 4.7.2 Compatibility 原生渲染，640×640。Idle 30FPS、14秒完整循环；Walk120FPS、Run60FPS，用完整周期重复约8秒，不做插帧、变速或 CrossFade。共36段：canonical与两角色各12段。','',
'| 对象 | Idle Front | Walk Side | Run Three-quarter | Feet（Idle / Walk / Run） |','|---|---|---|---|']
for cid in ['canonical','xia_zhiyao','su_wanxing']:
    base='evidence/'+cid
    lines.append(f'| {cid} | [视频]({base}/public_idle/front.mp4) | [视频]({base}/public_walking/side.mp4) | [视频]({base}/public_running/three_quarter.mp4) | [Idle]({base}/public_idle/feet.mp4) / [Walk]({base}/public_walking/feet.mp4) / [Run]({base}/public_running/feet.mp4) |')
lines+=['','[Xia 袖臂近景](evidence/xia_zhiyao/public_idle/details/upper_front_sheet.jpg) · [Su 袖臂近景](evidence/su_wanxing/public_running/details/upper_front_sheet.jpg)。所有额外 Front/Side/3⁄4/Feet 和阶段图均在 [视频总览](index.html)。','',
'## 验证、文件与边界','',
f'- canonical headless：43,533 项检查，0失败；双角色：{raw["checks"]:,} 项检查，0资源/轨道失败。技术检查通过不等于视觉通过。',
'- 单独核对公共源哈希、Source→Canonical映射、上半身参考姿态、骨长/层级/local/global Rest、固定Root，以及两个角色的动画资源实例ID。',
'- Headless Import 与独立 Scene Load 通过，日志无 Missing Resource / UID / Parse Error；独立 Windows release 导出成功，原生独立程序启动180帧后退出码0。没有重建或替换正式 Gameplay EXE。',
'- 36段视频已用 ffprobe 核对帧数/时长/分辨率，并检查动作阶段图、上下身近景与首尾差分。',
f'- 初始保护快照{protection["count"]}个文件，其中{protection["unchanged"]}个哈希不变。唯一变化是已有并行工作中的 `missions/mission.gd`；本任务没有任何写入该文件的操作，未回退或覆盖它。Standard、两候选 Mesh/Skin/Rig、正式 Xia/Su、旧公共库与旧 Retarget 均未改。完整差异见 [protection-result.json](protection-result.json)。',
'- 新增：`assets/animations/public_locomotion/` 的三动画、库与provenance；`art/blender/scripts/canonical_locomotion/` 的离线转换与QA工具；`docs/CANONICAL_PUBLIC_LOCOMOTION_REPORT.md`。证据、源采样、视频、独立项目与EXE位于当前 test-output 目录。',
'- 未修改主计划的功能完成状态：本次为未集成候选交付，双角色生产门禁仍失败；以本验收报告记录结果。','',
'## 生产结论与下一步','',
'**尚未达到所有 Unified Survivor 共用一套 Locomotion 的生产标准。**共享资源、统一Skeleton与canonical动作源转换已成立；阻塞项是候选 A Mesh / T Rig 的解剖绑定位置和真实鞋底/Toe支点适配。','',
'建议下一步专门做统一 Bind Pose / Skin Alignment 审计与修正，保持23骨合同和这一份公共动作。需要统一的是网格相对骨架的绑定关系，而不是再生成 Xia/Su 专属动作。当前尚不能保证只重算权重就足够，可能需要在不改骨架合同的前提下重新对齐 Mesh Bind Pose；本轮没有执行。','',
'已停止，不接入 Gameplay、Combat、Armed 或其余 Survivor。']
(P/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
sections=[]
for cid in ['canonical','xia_zhiyao','su_wanxing']:
    sections.append(f'<h2>{html.escape(cid)}</h2>')
    for clip in ['public_idle','public_walking','public_running']:
        sections.append(f'<h3>{clip}</h3><div class="grid">')
        for m in media:
            if m['actor']==cid and m['clip']==clip:
                sections.append(f'<figure><figcaption>{m["view"]}</figcaption><video controls loop preload="none" poster="evidence/{cid}/{clip}/{m["view"]}/0000.png" src="{m["path"]}"></video><a href="evidence/{cid}/{clip}/{m["view"]}_sheet.jpg">阶段图</a></figure>')
        sections.append('</div>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Canonical Public Locomotion 验收</title><style>body{background:#17202b;color:#edf2f7;font:16px system-ui;margin:32px auto;max-width:1300px;padding:0 20px}a{color:#82caff}h1{font-size:28px}.verdict{padding:20px;background:#452d34;border-left:4px solid #e99099}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}video{width:100%;background:#293442}figcaption{margin:8px 0}@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}}</style><h1>Canonical Public Locomotion V1</h1><p class="verdict">Canonical 转换通过。Xia / Su 动态蒙皮 FAIL，尚未达到生产标准：袖臂进入躯干，真实鞋底 Push Off 仍有接触偏差。</p><p><a href="REPORT.md">完整报告</a> · <a href="build/CanonicalLocomotionReview.exe">独立验收程序</a></p>'''+''.join(sections)+'</html>'
(P/'index.html').write_text(page,encoding='utf-8')
doc='''# Canonical Public Locomotion Library V1

本轮已使用通过验收的 Standard `idle.tres / walking.tres / running.tres` 做一次公共离线转换。新增唯一公共 [Library](../assets/animations/public_locomotion/public_locomotion.tres) 及三份 `public_*` 动作，时长保持14 / 1.0416667 / 0.6666667秒，未接入正式角色或 Gameplay。

**Canonical技术与参考鞋底QA通过；Xia / Su动态蒙皮FAIL；不满足生产放行条件。**统一Authoring Reference恢复Standard实际摆臂后，现有A Pose Mesh与T Pose Rig的绑定位置仍造成袖臂进入躯干。鞋前掌Push Off也有约17–22mm离地残差。不能通过更改公共动作姿态掩盖绑定问题。

- [完整映射、Rest-space说明、测量与边界](../test-output/canonical-public-locomotion/REPORT.md)
- [36段原生视频与阶段图](../test-output/canonical-public-locomotion/index.html)
- [独立Windows验收程序](../test-output/canonical-public-locomotion/build/CanonicalLocomotionReview.exe)
- [复现脚本](../art/blender/scripts/canonical_locomotion/reproduce.ps1)
- [来源与验收状态](../assets/animations/public_locomotion/provenance.json)

没有修改Standard源、Xia/Su候选或正式Mesh/Skin/Skeleton、旧Retarget、旧公共库或Gameplay速度。保护快照258项中257项不变；唯一变化为并行工作中的`missions/mission.gd`，本任务未写入或回退该文件。主计划不登记功能完成，本轮是隔离候选与验收证据交付。

下一步建议先处理统一Bind Pose / Skin Alignment及Foot/Toe鞋底支点，再用同一份公共库复验；本轮不执行绑定修改，不扩展Combat/Armed或其他Survivor。
'''
(APP/'docs/CANONICAL_PUBLIC_LOCOMOTION_REPORT.md').write_text(doc,encoding='utf-8')
(P/'delivery.json').write_text(json.dumps({'canonical_gate':gate['pass'],'dual_skin_gate':False,'production_ready':False,'shared_motion_max_matrix_difference':motion_diff,'videos':len(media),'formal_resources_added':5,'standalone_export':'build/CanonicalLocomotionReview.exe','gameplay_integrated':False},indent=2))
print('Report, gallery and production FAIL verdict written')
