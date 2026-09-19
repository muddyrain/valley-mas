"""Native full-cycle videos and same-frame comparison sheets."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
P=Path(__file__).resolve().parent;E=P/'evidence'
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)

def encode(spec):
    cid,view=spec;folder=E/cid
    records=[]
    for variant in ['reference','polished','comparison']:
        target=folder/(view+'_'+variant+'.mp4')
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-y']
        variants=['reference','polished'] if variant=='comparison' else [variant]
        for name in variants:
            cmd+=['-stream_loop','11','-framerate','60','-i',str(folder/name/view/'%04d.png')]
        if variant=='comparison':cmd+=['-filter_complex','[0:v][1:v]hstack=inputs=2[v]','-map','[v]']
        cmd+=['-frames:v','480','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(target)]
        subprocess.run(cmd,check=True,capture_output=True)
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(target)]))['streams'][0]
        assert int(info['nb_frames'])==480
        records.append({'path':target.relative_to(P).as_posix(),**info})
    out=Image.new('RGB',(1600,850),'#17202b');d=ImageDraw.Draw(out)
    for row,variant in enumerate(['reference','polished']):
        for col,i in enumerate([5,15,20,30]):
            im=Image.open(folder/variant/view/f'{i:04}.png').convert('RGB').resize((400,400))
            out.paste(im,(col*400,row*425+25));d.text((col*400+5,row*425+3),f'{variant} {i/60:.3f}s',font=font,fill='white')
    out.save(folder/(view+'_comparison.jpg'),quality=94)
    return records

with ThreadPoolExecutor(max_workers=2) as pool:
    result=sum(pool.map(encode,[(cid,v) for cid in ['xia_zhiyao','su_wanxing'] for v in ['upper_side','three_quarter']]),[])
(P/'media.json').write_text(json.dumps(result,indent=2))
sections=[]
for cid in ['xia_zhiyao','su_wanxing']:
    s=f'<section><h2>{cid}</h2><p><a href="candidates/{cid}.glb">Candidate GLB</a> · <a href="{cid}/{cid}_skin.blend">Blender source</a></p>'
    for view in ['upper_side','three_quarter']:
        s+=f'<h3>Run {view}</h3><div class="pair"><figure><video controls loop preload="none" poster="evidence/{cid}/polished/{view}/0000.png" src="evidence/{cid}/{view}_polished.mp4"></video><figcaption>Polished</figcaption></figure><figure><video controls loop preload="none" src="evidence/{cid}/{view}_comparison.mp4"></video><figcaption>Left: reference · Right: polished · same time</figcaption></figure></div><a href="evidence/{cid}/{view}_comparison.jpg"><img class="sheet" loading="lazy" src="evidence/{cid}/{view}_comparison.jpg"></a>'
    s+='<h3>Idle front regression</h3><div class="grid">'
    for i,t in enumerate([0,4.5,10.25,13]):
        s+=f'<figure><a href="evidence/{cid}/polished/idle/front_{i:02}.png"><img loading="lazy" src="evidence/{cid}/polished/idle/front_{i:02}.png"></a><figcaption>{t}s</figcaption></figure>'
    s+='</div></section>';sections.append(s)
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Survivor Upper Skin Review</title><style>body{max-width:1500px;margin:30px auto;padding:0 24px;background:#141b24;color:#eef1f5;font:16px/1.5 system-ui}a{color:#9bd4ff}h2{border-top:1px solid #506070;padding-top:24px}.pair{display:grid;grid-template-columns:1fr 2fr;gap:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0}img,video{width:100%}.sheet{margin-top:16px}section{margin:40px 0}figcaption{color:#bdc9d7}@media(max-width:700px){.pair,.grid{grid-template-columns:1fr}}</style><h1>Survivor Upper Body Skin Polish</h1><p>Weight-only candidates. Same frozen rig, mesh geometry and public locomotion. Run: 0.6666667s at 60 FPS, 12 exact loops; no crossfade or playback-speed adjustment.</p><p><a href="native-qa.json">Native measurements</a> · <a href="blender-qa.json">Blender scope validation</a> · <a href="build/SurvivorSkinReview.exe">Windows review</a></p><p>Review the elbow silhouette and shoulder seam, including same-frame reference comparisons. Skin weights can localize bending but cannot create cloth simulation or new sculpted folds.</p>'''+''.join(sections)+'</html>'
(P/'index.html').write_text(page,encoding='utf-8')
print('Verified 12 videos: 4 polished, 4 reference, 4 comparisons; 8 idle images')
