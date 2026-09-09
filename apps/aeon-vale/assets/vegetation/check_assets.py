"""Check shipped frames, not merely the generated source sheet."""
from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parent
errors=[]; frames=0; max_colors=0
for name,cell in [('near',(40,48)),('middle',(20,24)),('far',(4,5))]:
    sheet=Image.open(ROOT/(name+'.png')).convert('RGBA')
    if sheet.size!=(cell[0]*30,cell[1]*42): errors.append(name+' size')
    for species in range(1,71):
        for stage in range(6):
            for variant in range(3):
                idx=(species-1)*18+stage*3+variant; x=idx%30*cell[0]; y=idx//30*cell[1]
                frame=sheet.crop((x,y,x+cell[0],y+cell[1])); values=set(frame.get_flattened_data())
                label=f'{name}/{species}/{stage}/{variant}'
                frames+=1; colors=sum(p[3]>0 for p in values); max_colors=max(max_colors,colors)
                if any(p[3] not in [0,255] for p in values): errors.append(label+' non-binary alpha')
                if any(p[3]==0 and p[:3]!=(0,0,0) for p in values): errors.append(label+' hidden RGB')
                if colors>(3 if name=='far' else 10): errors.append(label+' palette')
                if not frame.getbbox() and (name=='near' or stage in [2,3,4]): errors.append(label+' empty')
                if name=='near' and frame.getbbox():
                    box=frame.getbbox()
                    if box[0]<1 or box[1]<1 or box[2]>39 or box[3]>46: errors.append(label+' clipped')
report={'frames':frames,'max_opaque_colors':max_colors,'errors':errors}
(ROOT/'technical-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
raise SystemExit(bool(errors))
