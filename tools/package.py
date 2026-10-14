from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
subprocess.run(['node', 'tools/build.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-demo.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-tongzhi-demo.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-zhifu-demo.mjs'], cwd=root, check=True)
subprocess.run(['node', 'tools/make-accountability-demo.mjs'], cwd=root, check=True)
out = root / 'outputs/古代官员升职记_县府四任试玩包.zip'
out.parent.mkdir(exist_ok=True)
evidence = ['ui-v0.10-map390.jpg', 'ui-v0.10-map320.jpg', 'ui-v0.10-cases390.jpg', 'ui-v0.10-routine.jpg', 'v0.10/tests.log', 'v0.10/release-tests.log', 'v0.10/content-verification.json']
instructions = '''古代官员升职记 · 县府四任（周制）

解压后，macOS 可双击“启动游戏.command”，然后打开：
http://127.0.0.1:8765
需要 Python 3。也可在解压目录的终端执行：
python3 -m http.server 8765 --bind 127.0.0.1
不要直接双击 index.html；模块和美术清单需要 HTTP。

每次结算推进一周，每季13周，每年52周，三年156周考满。
每周恢复精力，工程逐周推进；案卷复核2周，判后执行2周；拟判须留足4周。协济2周、采购1周。
财政与家计分周结算，秋收每年只结算一次。

县政：役政、市政、安民三类方针按周执行，钱粮不足时停支。
辖地：四处地方各有生计、生产、秩序，可投入督办、积累人物互信。
案牍：复核通过后，4周内安排执行，2周后查验；迟延仍可补办。
回执：每次操作显示实际增减，周末列出实际账目及政策执行情况。
第二、第三年增加18件独立阶段事务，查核等2周，物料投入等3周，以核验结果留卷。
部分地方要务先核实再投入，2周交验；跟办可提前1周，成果仍到期入账。
常例推进最多13周，每周结算并保存，遇新待办、交付、秋收或阶段交界即停。
开集增收按生产、秩序与季节折算；无在建工程时，雇工与赶工停支。

当前v0.10，存档v10，详细规则见“玩家办事指南_v0.10.md”。
旧季度档和旧周制档自动升级，保留钱粮、证据、选择及待办。
旧档已结案件视为旧卷归档，不追加执行责任；已考满旧县任保留原考语与任命资格。
新县任称职须同时完成四案复核和执行；未竟案卷须在整改附卷逐条补查并呈核正式移交。
若更换目录或浏览器，请先从旧游戏设置复制或导出履历，再导入新版。
文件下载不可用时，使用设置中的“履历文本备份与恢复”。

知县考满称职且无待查责任，可办理府通判任命，继续三年156周粮运任期。
通判考满称职无待查责任，可接任同知，继续三年156周跨县水利赈济。
同知考满称职，可接任知府，继续三年156周府政统筹。按察副使及更高任期尚未开放。

考满不合格进入13周整改、26周复考；高阶职务复考失败可降调试用，再失败则罢官。
主动违法单独查证、申辩与复核，可能罢官、下狱或流放；故意杀人重案可经额外核准判斩。

包内“体验履历”含通判、同知、知府开局及整改、查案申辩演示档。导入前请先导出自己的履历，体验后可恢复。
关闭服务所在终端即可停止本地服务。
'''
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in sorted((root / 'dist').rglob('*')):
        if path.is_file():
            archive.write(path, str(Path('古代官员升职记') / path.relative_to(root / 'dist')))
    for name in ['玩家办事指南_v0.10.md', '修复验收_v0.10.md']:
        archive.write(root / name, '古代官员升职记/' + name)
    archive.write(root / '考课与处分说明_v0.7.md', '古代官员升职记/考课与处分说明_v0.7.md')
    for name in ['考课_整改开局体验履历.json', '考课_查案申辩体验履历.json']:
        archive.write(root / 'outputs' / name, '古代官员升职记/体验履历/' + name)
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
    for name in evidence:
        archive.write(root / 'outputs/qa' / name, '古代官员升职记/outputs/qa/' + name)
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
    for name in evidence:
        archive.write(root / 'outputs/qa' / name, 'outputs/qa/' + name)
    for name in ['index.html','manifest.webmanifest','package.json','.gitignore','启动游戏.command']:
        archive.write(root / name, name)
print(f'{source.name}: {source.stat().st_size} bytes')
