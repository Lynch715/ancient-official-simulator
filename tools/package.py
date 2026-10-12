from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
subprocess.run(['node', 'tools/build.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-demo.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-tongzhi-demo.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-zhifu-demo.mjs'], cwd=root, check=True)
out = root / 'outputs/古代官员升职记_县府四任试玩包.zip'
out.parent.mkdir(exist_ok=True)
instructions = '''古代官员升职记 · 县府四任（周制）

解压后，macOS 可双击“启动游戏.command”，然后打开：
http://127.0.0.1:8765
需要 Python 3。也可在解压目录的终端执行：
python3 -m http.server 8765 --bind 127.0.0.1
不要直接双击 index.html；模块和美术清单需要 HTTP。

每次结算推进一周，每季13周，每年52周，三年156周考满。
每周恢复精力，工程逐周推进；案卷复核2周、协济2周、采购1周。
财政与家计分周结算，秋收每年只结算一次。

县政：役政、市政、安民三类方针按周执行，钱粮不足时停支。
辖地：四处地方各有生计、生产、秩序，可投入督办、积累人物互信。
案牍：复核通过后，4周内安排执行，2周后查验；迟延仍可补办。
回执：每次操作显示实际增减，周末列出实际账目及政策执行情况。

旧季度档和旧周制档自动升级，保留钱粮、证据、选择及待办。
旧档已结案件视为旧卷归档，不追加执行责任。
若更换目录或浏览器，请先从旧游戏设置复制或导出履历，再导入新版。
文件下载不可用时，使用设置中的“履历文本备份与恢复”。

知县考满称职且无待查责任，可办理府通判任命，继续三年156周粮运任期。
通判考满称职无待查责任，可接任同知，继续三年156周跨县水利赈济。
同知考满称职，可接任知府，继续三年156周府政统筹。按察副使及更高任期尚未开放。

包内“体验履历”含通判、同知与知府开局演示档。导入前请先导出自己的履历，体验后可恢复。
关闭服务所在终端即可停止本地服务。
'''
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in sorted((root / 'dist').rglob('*')):
        if path.is_file():
            archive.write(path, str(Path('古代官员升职记') / path.relative_to(root / 'dist')))
    archive.write(root / '玩法深化说明_v0.2.md', '古代官员升职记/玩法深化说明_v0.2.md')
    archive.write(root / '知府任职说明_v0.6.md', '古代官员升职记/知府任职说明_v0.6.md')
    archive.write(root / 'outputs/永平府_知府开局体验履历.json', '古代官员升职记/体验履历/永平府_知府开局体验履历.json')
    archive.write(root / '同知任职说明_v0.5.md', '古代官员升职记/同知任职说明_v0.5.md')
    archive.write(root / 'outputs/永平府_同知开局体验履历.json', '古代官员升职记/体验履历/永平府_同知开局体验履历.json')
    archive.write(root / '手机与发布说明_v0.4.md', '古代官员升职记/手机与发布说明_v0.4.md')
    archive.write(root / '府级任职说明_v0.3.md', '古代官员升职记/府级任职说明_v0.3.md')
    archive.write(root / 'outputs/永平府_通判开局体验履历.json', '古代官员升职记/体验履历/永平府_通判开局体验履历.json')
    archive.write(root / '启动游戏.command', '古代官员升职记/启动游戏.command')
    archive.writestr('古代官员升职记/开始试玩.txt', instructions)
print(f'{out.name}: {out.stat().st_size} bytes')

source = root / 'outputs/古代官员升职记_GitHub源码包.zip'
with ZipFile(source, 'w', ZIP_DEFLATED) as archive:
    for folder in ['src', 'assets', 'tools', 'tests', '.github']:
        for path in sorted((root / folder).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                archive.write(path, str(path.relative_to(root)))
    for path in sorted(root.glob('*.md')):
        if path.name != 'AGENTS.md':
            archive.write(path, path.name)
    for name in ['index.html','manifest.webmanifest','package.json','.gitignore','启动游戏.command']:
        archive.write(root / name, name)
print(f'{source.name}: {source.stat().st_size} bytes')
