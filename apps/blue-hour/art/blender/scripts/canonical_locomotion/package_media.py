"""Encode exact complete cycles at native capture cadence; no temporal resampling."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
import subprocess,json,math,sys
OUT=Path(__file__).resolve().parent
IDS=['xia_zhiyao','su_wanxing'] if '--dual' in sys.argv else ['canonical']
VIEWS=['front','side','three_quarter','feet']
CLIPS=[('public_idle',420,30),('public_walking',125,120),('public_running',40,60)]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
def encode(spec):
    cid,clip,n,fps,view=spec;folder=OUT/'evidence'/cid/clip
    cycles=1 if clip=='public_idle' else math.ceil(8/(n/fps));frames=cycles*n
    output=folder/(view+'.mp4')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-stream_loop',str(cycles-1),'-framerate',str(fps),'-i',str(folder/view/'%04d.png'),'-frames:v',str(frames),'-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],check=True,capture_output=True)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate,duration','-of','json',str(output)]))['streams'][0]
    assert int(probe['nb_frames'])==frames
    sheet=Image.new('RGB',(1440,800),'#17202b');d=ImageDraw.Draw(sheet)
    for j in range(8):
        i=int(j*n/8);im=Image.open(folder/view/f'{i:04d}.png').convert('RGB').resize((360,360))
        x=j%4*360;y=j//4*400;sheet.paste(im,(x,y+40));d.text((x+8,y+8),f'{clip} {view} | {i/fps:.3f}s',font=font,fill='white')
    sheet.save(folder/(view+'_sheet.jpg'),quality=92)
    return {'actor':cid,'clip':clip,'view':view,'path':output.relative_to(OUT).as_posix(),**probe}
with ThreadPoolExecutor(max_workers=2) as pool:
    result=list(pool.map(encode,[(cid,c,n,f,v) for cid in IDS for c,n,f in CLIPS for v in VIEWS]))
(OUT/('dual-media.json' if len(IDS)>1 else 'canonical-media.json')).write_text(json.dumps(result,indent=2))
print('Encoded and verified',len(result),'videos')
