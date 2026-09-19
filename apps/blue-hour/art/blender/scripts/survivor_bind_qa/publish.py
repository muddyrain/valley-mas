"""Package measured bind evidence and a local review gallery, without auto-passing skin."""
from pathlib import Path
import hashlib,json,html
from PIL import Image,ImageDraw,ImageFont

P=Path(__file__).resolve().parent;APP=P.parents[1]
E=P/'evidence'
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19)
def sheet(paths,output,columns=4):
    rows=(len(paths)+columns-1)//columns
    canvas=Image.new('RGB',(columns*360,rows*392),'#17202b');draw=ImageDraw.Draw(canvas)
    for i,(name,path) in enumerate(paths):
        im=Image.open(path).convert('RGB');im.thumbnail((360,360))
        x=i%columns*360;y=i//columns*392
        canvas.paste(im,(x+(360-im.width)//2,y+32))
        draw.text((x+8,y+7),name,font=font,fill='white')
    canvas.save(output,quality=93)

qa=json.loads((P/'dual-qa.json').read_text())
old=json.loads((APP/'test-output/canonical-public-locomotion/dual-qa.json').read_text())
upper=json.loads((P/'upper-dynamic-qa.json').read_text())
native=json.loads((P/'static-native-qa.json').read_text())
summary={'verdict':{'bind_contract':'PASS','public_direct_drive':'PASS','production_skin_release':'HOLD: shoulder, sleeve and hair/collar details require visual acceptance','gameplay_integrated':False},'characters':{},'source_protection':native['protection'],'shared_library':qa['same_library_instance'],'clip_bytes_unchanged':native['library_unchanged']}
sections=[]
for cid,label in [('xia_zhiyao','Xia Zhiyao'),('su_wanxing','Su Wanxing')]:
    static=[('T rest front',E/cid/'static/t_rest/front.png'),('T rest side',E/cid/'static/t_rest/side.png'),('T rest three-quarter',E/cid/'static/t_rest/three_quarter.png'),('Feet',E/cid/'static/t_rest/feet.png'),('Arm 45 lateral',E/cid/'static/arm_45/front.png'),('Arm 90 forward',E/cid/'static/arm_90/side.png'),('Elbow 90',E/cid/'static/elbow_90/three_quarter.png'),('Knee 90',E/cid/'static/knee_90/side.png')]
    sheet(static,E/cid/'static_sheet.jpg')
    section=f'<section><h2>{label}</h2><p><a href="candidates/{cid}.glb">Candidate GLB</a> · <a href="{cid}/{cid}_t_pose_bind.blend">Blender source</a></p><a href="evidence/{cid}/static_sheet.jpg"><img class="sheet" src="evidence/{cid}/static_sheet.jpg"></a><details><summary>All static probe views</summary><div class="grid">'
    for pose in ['t_rest','arm_45','arm_90','elbow_90','knee_90']:
        for view in ['front','side','three_quarter','feet']:
            src=f'evidence/{cid}/static/{pose}/{view}.png'
            section+=f'<figure><a href="{src}"><img loading="lazy" src="{src}"></a><figcaption>{pose} / {view}</figcaption></figure>'
    section+='</div></details>'
    summary['characters'][cid]={'height_m':qa['characters'][cid]['height_m'],'clips':{}}
    for clip in ['idle','walking','running']:
        data=qa['characters'][cid]['clips'][clip];before=old['characters'][cid]['clips'][clip]
        max_change=max(abs(a-b) for side in ['Left','Right'] for key in ['heel_flat_mm','forefoot_flat_mm','landing_heel_mm','push_forefoot_mm'] for a,b in zip(data['contact'][side][key],before['contact'][side][key]))
        summary['characters'][cid]['clips'][clip]={'contact':data['contact'],'foot_contact_change_mm':max_change,'loop_mesh_gap_mm':data['loop_mesh_gap_mm'],'upper':upper[cid]['public_'+clip]}
        section+=f'<h3>{clip.title()}</h3><div class="grid">'
        for view in ['front','side','three_quarter','feet']:
            src=f'evidence/{cid}/public_{clip}/{view}.mp4'
            section+=f'<figure><video controls loop preload="none" poster="evidence/{cid}/public_{clip}/{view}/0000.png" src="{src}"></video><figcaption>{view}</figcaption></figure>'
        section+='</div>'
        for view in ['upper_front','upper_back','upper_side','feet_side']:
            paths=[(f'{view} phase {i}/8',E/cid/f'public_{clip}/details/{view}_{i:02}.png') for i in range(8)]
            target=E/cid/f'public_{clip}/{view}_details.jpg';sheet(paths,target)
        section+='<details><summary>Eight-phase upper body and feet details</summary>'
        for view in ['upper_front','upper_back','upper_side','feet_side']:
            src=f'evidence/{cid}/public_{clip}/{view}_details.jpg'
            section+=f'<a href="{src}"><img class="sheet" loading="lazy" src="{src}"></a>'
        section+='</details>'
    section+='</section>';sections.append(section)
(P/'bind-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unified Survivor T-Pose Bind Review</title><style>body{max-width:1500px;margin:32px auto;padding:0 24px;background:#141b24;color:#eef1f5;font:16px/1.5 system-ui}a{color:#9bd4ff}h1{font-size:30px}h2{border-top:1px solid #506070;padding-top:24px}section{margin:40px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}figure{margin:0}img,video{width:100%;background:#263341}.sheet{max-width:1440px}summary{cursor:pointer;padding:16px 0}figcaption{padding:6px 0;color:#bdc9d7}p{max-width:1000px}</style><h1>Unified Survivor T-Pose Bind Review</h1><p>Two isolated candidates · frozen 23-bone rig · one unchanged public locomotion library. Review static binding, sleeve and hair deformation, and foot preservation before release.</p><p><a href="build/SurvivorBindReview.exe">Windows interactive review</a> · <a href="bind-summary.json">Measurements</a> · <a href="bind-contract-qa.json">Blender contract</a> · <a href="static-native-qa.json">Native contract and source protection</a></p><p>Arm 45: lateral elevation from arms down. Arm 90: forward shoulder flexion. T rest: lateral 90. Knee probe: thigh 30 + knee 90. Walk and Run videos repeat exact cycles; no crossfade. Edge-stretch metrics locate defects and do not prove absence of intersections.</p>'''+''.join(sections)+'</html>'
page=page.replace('<h1>Unified Survivor T-Pose Bind Review</h1>','<h1>Unified Survivor T-Pose Bind Review</h1><p><strong>Bind contract / shared animation: PASS. Production skin release: HOLD.</strong> Inspect shoulder, sleeve and hair/collar details. Local arm envelope fitting and existing skirt / toe-off limitations are documented in the report.</p>')
(P/'index.html').write_text(page,encoding='utf-8')
manifest={str(f.relative_to(P)):hashlib.sha256(f.read_bytes()).hexdigest() for f in list((P/'candidates').glob('*.glb'))+list((P/'assets').glob('*.tres'))}
(P/'delivery-hashes.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Published gallery, static/detail sheets, summary and artifact hashes')
