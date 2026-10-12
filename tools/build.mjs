import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('assets/art/manifest.json'));
let count=0;
for(const a of Object.values(manifest.assets))for(const v of a.runtimeVariants){
 const bytes=fs.readFileSync(v.path);
 if(bytes.length!==v.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==v.sha256)throw Error(`资源不匹配：${v.path}`);
 count++;
}
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
for(const file of ['index.html','manifest.webmanifest'])fs.copyFileSync(file,`dist/${file}`);
for(const dir of ['src','assets'])fs.cpSync(dir,`dist/${dir}`,{recursive:true});
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk('dist').map(p=>p.slice(5)).sort();
const template=fs.readFileSync('tools/sw-template.js','utf8');
const hash=crypto.createHash('sha256').update(template);
for(const file of files)hash.update(file).update('\0').update(fs.readFileSync(`dist/${file}`));
const build=hash.digest('hex').slice(0,12);
const html=fs.readFileSync('dist/index.html','utf8').replace('</head>',`<meta name="offline-build" content="${build}">\n</head>`);
fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/sw.js',template.replace('__BUILD_ID__',JSON.stringify(build)).replace('__PRECACHE__',JSON.stringify(files)));
fs.writeFileSync('dist/.nojekyll','');
console.log(`静态站点 ${build} 已生成：72 项美术资源，${count} 个美术运行文件，${files.length} 个离线文件，校验通过。`);
