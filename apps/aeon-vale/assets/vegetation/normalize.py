"""Canonical, reproducible pixel-grid and palette normalization for vegetation."""
from pathlib import Path
from collections import deque
import colorsys
import json
from PIL import Image, ImageDraw, ImageColor

ROOT = Path(__file__).resolve().parent
CELLS = [(40, 48), (20, 24), (4, 5)]
FAMILIES = ['oak', 'birch', 'fir', 'acacia', 'palm', 'cherry', 'mushroom', 'crystal']
BOTANICAL = ['willow','bamboo','banana','cactus','citrus','jade','candy','bottle','fern','grass','berry','flower']
GROUNDCOVER = ['seed','sprout','dead','rock','small_mushroom','lavender','reed','agave']
SPECIES = [
    (1,0,1,'72913e'),(2,1,.86,'9bac50'),(3,2,.88,'597d44'),
    (4,2,.88,'a9b9a5'),(5,3,.91,'aa973e'),(6,0,1,'9a9245'),
    (7,5,1,'c590a5'),(9,4,.95,'80a04e'),(11,2,.70,'6a864e'),
    (12,0,1.05,'819c50'),(21,0,.95,'819f42'),(22,0,.89,'749548'),
    (23,1,.91,'91a354'),(24,2,.89,'749149'),(25,0,1.01,'64843b'),
    (26,3,1,'b5a64b'),(27,0,.93,'b27f49'),(28,2,.83,'a59f58'),
    (29,2,.92,'63885f'),(30,2,.70,'7b945b'),(31,1,.72,'b3a558'),
    (32,3,1,'a09a4f'),(33,2,.80,'70925d'),(34,5,.86,'cdb5bc'),
    (68,5,1,'a69abe'),(69,2,.84,'618754'),(54,6,1,'a99bc3'),(58,7,.9,'79b6b6')]

def isolate(part):
    """Key only the pale backdrop connected to the cell edge, not white bark."""
    part=part.convert('RGBA'); p=part.load(); seen=set(); todo=deque()
    def background(x,y):
        r,g,b,a=p[x,y]
        return a<210 or (min(r,g,b)>204 and max(r,g,b)-min(r,g,b)<28)
    for x in range(part.width):
        todo.append((x,0)); todo.append((x,part.height-1))
    for y in range(part.height):
        todo.append((0,y)); todo.append((part.width-1,y))
    while todo:
        x,y=todo.popleft()
        if (x,y) in seen or not (0<=x<part.width and 0<=y<part.height): continue
        seen.add((x,y))
        if not background(x,y): continue
        p[x,y]=(0,0,0,0)
        todo.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    # Drop detached generation specks while preserving internal holes.
    seen=set(); groups=[]
    for y in range(part.height):
        for x in range(part.width):
            if not p[x,y][3] or (x,y) in seen: continue
            group=[]; todo=deque([(x,y)]); seen.add((x,y))
            while todo:
                a,b=todo.popleft(); group.append((a,b))
                for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                    q=(a+dx,b+dy)
                    if 0<=q[0]<part.width and 0<=q[1]<part.height and q not in seen and p[q][3]:
                        seen.add(q); todo.append(q)
            groups.append(group)
    biggest=max(map(len,groups))
    for group in groups:
        if len(group)<biggest:
            for q in group: p[q]=(0,0,0,0)
    return part.crop(part.getbbox())

def snap(source,size,colors=10):
    im=source.resize(size,Image.Resampling.BOX)
    im.putdata([(*p[:3],255) if p[3]>=140 else (0,0,0,0) for p in im.get_flattened_data()])
    im=im.quantize(colors=colors+1,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).convert('RGBA')
    im.putdata([(*p[:3],255) if p[3]>=128 else (0,0,0,0) for p in im.get_flattened_data()])
    return im

def anchor(sprite,cell=(40,48)):
    im=Image.new('RGBA',cell)
    im.paste(sprite,((cell[0]-sprite.width)//2,cell[1]-3-sprite.height))
    return im

def overview_frame(frame):
    """Coverage-sample the approved sprite onto the world-cell overview grid.

    No new silhouettes: preserve the source footprint, three dominant colours,
    binary coverage and a shared ground pivot. Small seedlings retain one texel.
    """
    part=frame.crop(frame.getbbox())
    size=(max(1,round(part.width/10)),max(1,round(part.height/10)))
    sampled=part.resize(size,Image.Resampling.BOX)
    pixels=list(sampled.get_flattened_data())
    threshold=min(96,max(p[3] for p in pixels))
    opaque=[p[:3] for p in pixels if p[3]>=threshold]
    strip=Image.new('RGB',(len(opaque),1)); strip.putdata(opaque)
    quantized=strip.quantize(colors=3,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
    palette=sorted(set(quantized.get_flattened_data()))
    sampled.putdata([(*min(palette,key=lambda c:sum((c[k]-p[k])**2 for k in range(3))),255)
                     if p[3]>=threshold else (0,0,0,0) for p in pixels])
    result=Image.new('RGBA',(4,5))
    result.paste(sampled,((4-size[0])//2,5-size[1]))
    return result

def source_frames(file,columns,rows):
    source=Image.open(ROOT/'sources'/file)
    frames=[]
    for i in range(columns*rows):
        x=i%columns*source.width//columns; y=i//columns*source.height//rows
        part=isolate(source.crop((x,y,x+source.width//columns,y+source.height//rows)))
        part.thumbnail((34,37),Image.Resampling.BOX)
        frames.append(anchor(snap(part,part.size)))
    return frames

def tint(im,target,family=''):
    h_target,s_target,_=colorsys.rgb_to_hsv(*(n/255 for n in ImageColor.getrgb('#'+target)))
    data=[]
    for r,g,b,a in im.get_flattened_data():
        h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
        foliage=s>.22 and (h>.14 or b>g)
        if family=='flower': foliage=(s<.22 and v>.60) or (h<.18 and v>.65)
        elif family=='lavender': foliage=h>.55
        elif family in ['mushroom','small_mushroom']: foliage=b>r*.9 and b>g
        if a and foliage:
            h=h_target; s=min(.65,s*.35+s_target*.65)
            r,g,b=[round(c*255) for c in colorsys.hsv_to_rgb(h,s,v*.91)]
        data.append((r,g,b,a))
    im.putdata(data); return im

def build():
    masters=dict(zip(FAMILIES,source_frames('woodland.png',4,2)))
    masters.update(zip(BOTANICAL,source_frames('botanical.png',4,3)))
    masters.update(zip(GROUNDCOVER,source_frames('groundcover.png',4,2)))
    recipes={s:(FAMILIES[f],w,1,t) for s,f,w,t in SPECIES}
    # Families share lighting and native grid. Shape/scale/hue derivatives remain
    # explicit: these are 28 source subjects, not 70 independently drawn originals.
    recipes.update({
      8:('small_mushroom',.64,.38,'bb7c70'),10:('cactus',.75,.90,'809848'),
      12:('willow',1,1,'86a356'),13:('rock',.52,.37,None),14:('rock',.80,.61,None),
      15:('flower',.52,.34,'e4d58b'),16:('berry',.65,.45,'86a051'),
      17:('grass',.43,.25,'83a44f'),18:('reed',.49,.55,'8da85c'),
      19:('berry',.51,.35,'becbb4'),20:('grass',.54,.32,'b6a66a'),
      26:('citrus',.92,.98,'c7bb57'),35:('fern',.62,.40,'73a157'),
      36:('fern',.42,.26,'9ab05a'),37:('flower',.50,.32,'eee2ac'),
      38:('lavender',.51,.43,'a08cb2'),39:('flower',.51,.38,'c98772'),
      40:('lavender',.58,.42,'ab9aba'),41:('flower',.44,.28,'e5e9d5'),
      42:('grass',.46,.27,'bccfc3'),43:('agave',.66,.43,'9dae77'),
      44:('agave',.54,.36,'7faf89'),45:('berry',.47,.37,'b8a771'),
      46:('reed',.60,.56,'99aa59'),47:('flower',.49,.42,'a396b8'),
      48:('grass',.47,.37,'82a078'),49:('berry',.60,.40,'87a367'),
      50:('small_mushroom',.53,.40,'8aa8c6'),51:('bamboo',.87,1,'85a45e'),
      52:('fern',.80,.59,'79a260'),53:('banana',.94,.92,'87a24b'),
      54:('mushroom',1,.92,'b0a0c2'),55:('citrus',.92,.92,'c9c966'),
      56:('citrus',1,.94,'b6c465'),57:('citrus',.83,1,'d2bb60'),
      58:('crystal',.86,.89,'b6a4cb'),59:('crystal',.67,1,'91b9cd'),
      60:('crystal',1,.87,'c59cb7'),61:('jade',.90,.92,'84bda7'),
      62:('jade',1,1,'9cc6b0'),63:('candy',.95,.95,'cba4b6'),
      64:('fir',.95,.97,'c5bdcb'),65:('bottle',.93,.98,'9eac63'),
      66:('grass',.40,.29,'aab26c'),67:('flower',.49,.36,'d5b3ca'),
      70:('reed',.55,.68,'84a46e')})
    assert set(recipes)==set(range(1,71))
    sheets=[Image.new('RGBA',(cell[0]*30,cell[1]*42)) for cell in CELLS]
    manifest=[]
    adult_frames=[]
    for species in range(1,71):
        family,width,height,target=recipes[species]
        base=masters[family].copy()
        if target: base=tint(base,target,family)
        manifest.append({'id':species,'family':family,'width':width,'height':height,'hue':target})
        for stage in range(6):
            for variant in range(3):
                part=base.crop(base.getbbox()); factor=.60 if stage==2 else 1
                size=(max(3,round(part.width*width*factor)-(2-variant)),max(3,round(part.height*height*factor)))
                if species not in [13,14]:
                    if stage in [0,1]:
                        part=masters['seed' if stage==0 else 'sprout']; part=part.crop(part.getbbox())
                        size=(3+variant,3) if stage==0 else (7+variant,8)
                    elif stage==5:
                        if height>.70 and family not in ['crystal','mushroom','cactus']:
                            part=masters['dead']; part=part.crop(part.getbbox()); size=(18+variant,26)
                        else:
                            part.putdata([(*(round(c*.15+d*.85) for c,d in zip(p[:3],(141,132,94))),p[3]) for p in part.get_flattened_data()])
                            size=(max(3,size[0]*2//3),max(3,size[1]*2//3))
                part=snap(part,size)
                frame=anchor(part)
                if stage==4:
                    frame.putdata([(*(round(c*.90+d*.10) for c,d in zip(p[:3],(165,145,83))),p[3]) for p in frame.get_flattened_data()])
                index=(species-1)*18+stage*3+variant
                for level,cell in enumerate(CELLS):
                    normalized=overview_frame(frame) if level==2 else snap(frame,cell)
                    sheets[level].paste(normalized,((index%30)*cell[0],(index//30)*cell[1]))
                if stage==3 and variant==2: adult_frames.append(frame)
    for name,sheet in zip(['near','middle','far'],sheets): sheet.save(ROOT/(name+'.png'))
    preview=Image.new('RGB',(1200,1008),'#b4ce7a'); d=ImageDraw.Draw(preview)
    for idx,frame in enumerate(adult_frames):
        x=idx%10*120; y=idx//10*144
        d.text((x+8,y+7),str(idx+1)+' '+recipes[idx+1][0],fill='#42563a')
        big=frame.resize((80,96),Image.Resampling.NEAREST); preview.paste(big,(x+16,y+28),big)
    preview.save(ROOT/'preview.png')
    manifest_data={'status':'normalized family; runtime evidence in docs/VALIDATION.md',
      'sources':['sources/woodland.png','sources/botanical.png','sources/groundcover.png'],
      'prompts':'sources/prompts.json','tool':'built-in image_gen','source_subjects':28,
      'native_cells':CELLS,'grid_columns':30,'states':['seed','sprout','young','adult','old','dead'],
      'variants':3,'frames_per_sheet':1260,'species':manifest,'pivot':[20,45],
      'overview':{'cell':[4,5],'pivot':[2,4],'opaque_colors':3,'world_cells_per_texel':1,
        'sampling':'coverage BOX preprocessing; nearest at runtime; no mipmaps',
        'source':'technical miniature of the approved near frame, no new generated subject'},
      'collision':'none; ecological occupancy remains in world data',
      'normalization':['edge-connected backdrop extraction','largest connected subject','BOX grid sampling',
        'near/middle: 10 opaque colours; far: 3 opaque colours; no dither','binary alpha; transparent RGB zero'],
      'provenance':'Original generated sprites. WorldBox screenshot used as a style reference; no extraction. Frames are declared size, palette and age derivatives, not independently painted originals.'}
    (ROOT/'manifest.json').write_text(json.dumps(manifest_data,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__': build()
