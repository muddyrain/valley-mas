"""Encode and validate twelve native Godot views with phase/loop evidence."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'test-output/xia-zhiyao-locomotion'
VIEWS = ('front','side','three_quarter','feet')
COUNTS = {'idle':1680,'walking':750,'running':800}
PERIODS = {'idle':14.0,'walking':25/24,'running':16/24}


def encode(job):
    clip,view = job
    target = OUT/f'{clip}_{view}.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','60','-i',str(OUT/'frames'/clip/view/'%05d.jpg'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]))
    stream = next(s for s in probe['streams'] if s['codec_type']=='video')
    files = sorted((OUT/'frames'/clip/view).glob('*.jpg'))
    assert len(files)==COUNTS[clip]
    assert int(stream['nb_frames'])==COUNTS[clip]
    assert stream['r_frame_rate']=='60/1'
    assert (stream['width'],stream['height'])==(960,720)
    duration = float(probe['format']['duration'])
    assert abs(duration-COUNTS[clip]/60)<.002
    first = Image.open(files[0]).convert('RGB')
    middle = Image.open(files[int(PERIODS[clip]*60*.3)]).convert('RGB')
    difference = ImageStat.Stat(ImageChops.difference(first,middle)).mean
    assert max(difference)>.1
    assert min(ImageStat.Stat(first).stddev)>15
    hashes = {hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
    assert len(hashes)>30
    for kind,indices in [('phases',[int(i*PERIODS[clip]*60/8) for i in range(8)]),('loop',[round(PERIODS[clip]*60)+i for i in range(-4,4)])]:
        sheet = Image.new('RGB',(1600,640),'#171d21')
        draw = ImageDraw.Draw(sheet)
        for i,index in enumerate(indices):
            x,y = i%4*400,i//4*320
            sheet.paste(Image.open(files[index]).resize((400,300)),(x,y+20))
            draw.text((x+6,y+4),f'{clip} | {view} | t={index/60:.4f}s',fill='white')
        sheet.save(OUT/f'{clip}-{view}-{kind}.jpg',quality=94)
    return f'{clip}_{view}',{'frames':len(files),'fps':60,'duration_s':duration,'unique_frames':len(hashes),'motion_pixels':difference,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}


if __name__=='__main__':
    jobs = [(clip,view) for clip in COUNTS for view in VIEWS]
    with ThreadPoolExecutor(max_workers=3) as pool:
        result = dict(pool.map(encode,jobs))
    (OUT/'video-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
