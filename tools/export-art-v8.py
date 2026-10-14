"""Export generated v0.8 assets: format conversion and proportional resize only."""
from pathlib import Path
import hashlib, json, shutil, math
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
prompt_file = root / 'art/prompts/audit-v0.8.json'
jobs = json.loads(prompt_file.read_text())['jobs']
manifest_path = root / 'assets/art/manifest.json'
manifest = json.loads(manifest_path.read_text())
assets, qa, previews = [], [], []
labels={'scene_prefecture_hall':'永平府议事堂','scene_embankment_calm':'东堤平水','avatar_official_qinghe':'许明远','avatar_official_linhe':'韩成','avatar_official_yongning':'顾允中'}
for appearance,character_name in [('a','沉静形象'),('b','明朗形象'),('c','专注形象')]:
    for role,office in [('prefecture','通判'),('tongzhi','同知'),('zhifu','知府')]: labels[f'portrait_player_{appearance}_{role}']=f'{character_name} {office}常服'

for job in jobs:
    if 'generatedPath' not in job:
        continue
    asset_id = job['id']
    kind = 'scene' if asset_id.startswith('scene_') else 'portrait' if asset_id.startswith('portrait_') else 'avatar'
    source = root / 'art/source/audit-v0.8' / (asset_id + '.png')
    source.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(job['generatedPath'], source)
    original = Image.open(source)
    specs = [('lg',1200,800),('sm',720,480)] if kind == 'scene' else [('main',640,960)] if kind == 'portrait' else [('md',256,256),('sm',96,96)]
    if abs(original.width/original.height-specs[0][1]/specs[0][2]) > .025:
        raise ValueError(f'{asset_id}: unexpected aspect ratio {original.size}; regenerate rather than stretch')
    im = original.convert('RGBA' if kind == 'portrait' else 'RGB')
    alpha = None
    if kind == 'portrait':
        extrema = im.getchannel('A').getextrema()
        transparent = im.getchannel('A').histogram()[0]
        if extrema[0] != 0 or extrema[1] < 250 or transparent < im.width*im.height*.2:
            raise ValueError(f'{asset_id}: missing genuine transparent background')
        alpha = {'extrema':list(extrema),'transparentPixels':transparent,'contentBounds':im.getchannel('A').getbbox()}
    variants = []
    directory = root / 'assets/art' / {'scene':'scenes','portrait':'portraits','avatar':'avatars'}[kind]
    directory.mkdir(parents=True,exist_ok=True)
    for name,w,h in specs:
        target = directory / f'{asset_id}_{name}.webp'
        im.resize((w,h),Image.Resampling.LANCZOS).save(target,'WEBP',quality=88,method=6)
        data=target.read_bytes()
        variants.append({'name':name,'path':str(target.relative_to(root)),'width':w,'height':h,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'targetMaxBytes':460800 if kind=='scene' and name=='lg' else 204800})
    character = '_'.join(asset_id.split('_')[1:3]) if kind == 'portrait' else asset_id.removeprefix('avatar_') if kind == 'avatar' else None
    item = {'id':asset_id,'type':kind,'phase':'v0.8','label':labels[asset_id],'status':'generated','characterId':character,'sourcePath':str(source.relative_to(root)),'sourceSize':[im.width,im.height],'runtimeVariants':variants,'slotIds':['scene_stage','event_visual'] if kind=='scene' else ['character_standing'] if kind=='portrait' else ['avatar_inline'],'transparency':'alpha' if kind=='portrait' else 'opaque','fit':'contain' if kind=='portrait' else 'cover','focalPoint':[.5,.5],'visualState':'neutral','reference':job.get('reference',str(source.relative_to(root)))}
    assets.append(item);manifest['assets'][asset_id]=item
    qa.append({'id':asset_id,'sourcePath':str(source.relative_to(root)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':[im.width,im.height],'alpha':alpha,'runtimeVariants':variants,'status':'generated','historicalLimit':'stylized fictional Ming-inspired clothing and environments; no exact rank-insignia claim'})
    previews.append((asset_id,im.copy()))

manifest['version']='v0.8-20261012'
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(root/'art/asset-manifest.v0.8.json').write_text(json.dumps({'schemaVersion':1,'generator':'builtin-imagegen','status':'generated','assets':assets},ensure_ascii=False,indent=2)+'\n')
(root/'art/qa/additions-v0.8.json').write_text(json.dumps({'generator':'builtin-imagegen','exportMethod':'format conversion and proportional Lanczos resize only','assets':qa},ensure_ascii=False,indent=2)+'\n')
sheet=Image.new('RGB',(1280,math.ceil(len(previews)/5)*400),'#f3ebdd');draw=ImageDraw.Draw(sheet)
for index,(name,im) in enumerate(previews):
    im.thumbnail((238,355),Image.Resampling.LANCZOS)
    x=(index%5)*256+(256-im.width)//2;y=(index//5)*400+8
    sheet.paste(im,(x,y),im.getchannel('A') if im.mode=='RGBA' else None)
    draw.text(((index%5)*256+8,(index//5)*400+375),name,fill='#292b27')
out=root/'outputs/qa/art-v0.8-contact.png';sheet.save(out)
print(f'Exported {len(assets)} assets; contact sheet: {out}')
