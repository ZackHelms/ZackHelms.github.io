import * as T from './vendor/three.module.min.js';
import {generatePuzzle,canSlide,directions} from './puzzle.js';
import {World} from './world.js';import {Sound} from './audio.js';
const $=id=>document.getElementById(id),defaults={material:'pine',background:'none',master:70,effects:75,ambient:40,muted:false,min:5,max:20};let saved={};try{saved=JSON.parse(localStorage.getItem('interlock-settings'))||{};}catch{}const s={...defaults,...saved};
const materials=[['pine','Light pine','#dec391'],['walnut','Warm walnut','#a27043'],['ebony','Dark ebony','#4e3426'],['rust','Rusty metal','#945030'],['metal','Polished metal','#b7c2cc'],['jello','Green jello','#53d97c'],['honey','Gold honey','#efac32'],['ice','Blue ice','#83d7ed']];if(!materials.some(m=>m[0]===s.material))s.material='pine';if(!['none','meadow','mountains','beach','arctic'].includes(s.background))s.background='none';for(const k of ['master','effects','ambient'])s[k]=Number.isFinite(+s[k])?Math.max(0,Math.min(100,+s[k])):defaults[k];s.muted=!!s.muted;
const bound=(v,d)=>v===''||!Number.isFinite(+v)?d:Math.max(5,Math.min(20,Math.round(+v)));s.min=bound(s.min,5);s.max=Math.max(s.min,bound(s.max,20));function save(){try{localStorage.setItem('interlock-settings',JSON.stringify(s));}catch{}}
let renderer;try{renderer=new T.WebGLRenderer({canvas:$('game'),antialias:true,alpha:false,powerPreference:'high-performance'});}catch{$('notice').hidden=false;$('notice').textContent='This game needs WebGL. Please open it in a browser with hardware acceleration enabled.';throw Error('WebGL unavailable');}renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.5,1400),root=new T.Group();scene.add(root);const world=new World(scene,renderer);world.set(s.background);const sound=new Sound(s);sound.bg=s.background;let puzzle,count=s.min,locked=false,zoom=1,arrival=0;const ray=new T.Raycaster(),pointer=new T.Vector2(),animations=[];let clockStart=performance.now();let lastTime=clockStart;
function texture(){const c=document.createElement('canvas');c.width=c.height=256;const a=c.getContext('2d');a.fillStyle='#d1bd99';a.fillRect(0,0,256,256);for(let x=0;x<256;x++){a.strokeStyle=`rgba(75,38,16,${.025+Math.random()*.09})`;a.lineWidth=.5+Math.random();a.beginPath();for(let y=0;y<=256;y+=4){const p=x+Math.sin(y*.018+x*.024)*3+Math.sin(y*.04)*.5;y?a.lineTo(p,y):a.moveTo(p,y);}a.stroke();}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;return tex;}const grain=texture();const rustCanvas=document.createElement('canvas');rustCanvas.width=rustCanvas.height=128;const rc=rustCanvas.getContext('2d'),rd=rc.createImageData(128,128);for(let i=0;i<rd.data.length;i+=4){const v=Math.random();rd.data[i]=90+v*150;rd.data[i+1]=65+v*100;rd.data[i+2]=40+v*80;rd.data[i+3]=255;}rc.putImageData(rd,0,0);const rustTexture=new T.CanvasTexture(rustCanvas);rustTexture.colorSpace=T.SRGBColorSpace;rustTexture.wrapS=rustTexture.wrapT=T.RepeatWrapping;
// The environment map is baked from the sky by world.js — see its header for
// why there is no studio rig here any more. Polished metal and the glass
// materials take their reflections from whatever is actually overhead, so a
// background with no sky ('none') supplies a dim neutral one instead.
function mat(id,radius){const def=materials.find(m=>m[0]===s.material),color=new T.Color(def[2]);color.offsetHSL((id%3-1)*.008,0,(id%5-2)*.025);const k=s.material,wood=['pine','walnut','ebony'].includes(k),glass=['jello','honey','ice'].includes(k),metal=k==='metal',rust=k==='rust';
// Glass is deliberately CLEARER than it was (.92 against .72) and gets its
// colour from absorption instead: attenuationDistance scales with the piece's
// own radius, so a chunky piece is deeply saturated and a thin one is nearly
// water. That is the depth cue that tells two overlapping pieces apart.
// polygonOffset pushes the filled surface a hair away from the camera so the
// edge lines sit in FRONT of it rather than z-fighting with it — without this
// the lines are coincident with the faces and simply never win the depth test.
return new T.MeshPhysicalMaterial({color,map:wood?grain:rust?rustTexture:null,
  roughness:wood?.43:metal?.14:rust?.85:k==='ice'?.055:glass?.09:.12,
  metalness:metal?1:rust?.7:0,
  transmission:glass?.92:0,
  thickness:glass?Math.max(.8,radius*.85):0,
  ior:k==='ice'?1.31:k==='honey'?1.48:k==='jello'?1.37:1.45,
  attenuationColor:color,attenuationDistance:glass?Math.max(4,radius*3.4):3,
  clearcoat:glass?.35:wood?.15:.3,clearcoatRoughness:glass?.07:.2,
  side:glass?T.DoubleSide:T.FrontSide,
  vertexColors:true,envMapIntensity:1,transparent:false,
  polygonOffset:true,polygonOffsetFactor:1.4,polygonOffsetUnits:1.4});}
// Edges must be OPAQUE, and that is not a style choice. three renders only the
// opaque list into the transmission render target, so a transparent line is
// invisible through a glass piece — which is exactly why the board used to
// show the background cleanly and show nothing of the other pieces (CD,
// 2026-09-20). Opaque lines land in that target and read through the glass.
function edgeMat(id){const def=materials.find(m=>m[0]===s.material),c=new T.Color(def[2]);c.offsetHSL((id%3-1)*.008,0,(id%5-2)*.025);const glass=['jello','honey','ice'].includes(s.material);
c.lerp(new T.Color(0x0a0806),glass?.60:.52);if(glass)c.lerp(new T.Color(0xcfe6ff),.14);
return new T.LineBasicMaterial({color:c,transparent:false});}

/* Voxel ambient occlusion, baked per vertex against the cells that are STILL
 * on the board. This is the other half of "shadow quality": a shadow map only
 * darkens what the sun is blocked from, and between two flush pieces the sun
 * was never reaching anyway — the seams were being filled in flat by the sky
 * ambient, which is exactly what ambient occlusion is for. Each face vertex
 * looks at the two edge neighbours and the corner neighbour one cell out along
 * the face normal; the classic 0-3 level, with the two-sided case forced dark.
 *
 * It is recomputed on every removal (`rebuildAO`), because a face that was
 * buried in a crevice is genuinely out in the open once the piece next to it
 * has slid away — bake it once and the board keeps painting shadows for pieces
 * that are no longer there. */
const AO_LEVEL=[0.42,0.60,0.79,1.0];
const FACES=[[[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],[[-1,0,0],[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]],[[0,0,1],[[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]]],[[0,0,-1],[[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]]];
function vertexAO(cell,dir,corner,occupied){
  // the two axes lying in the face plane
  const ax=[];for(let i=0;i<3;i++)if(dir[i]===0)ax.push(i);
  const at=o=>occupied.has((cell[0]+dir[0]+(o[0]||0))+','+(cell[1]+dir[1]+(o[1]||0))+','+(cell[2]+dir[2]+(o[2]||0)));
  const s1=[0,0,0];s1[ax[0]]=Math.sign(corner[ax[0]]);
  const s2=[0,0,0];s2[ax[1]]=Math.sign(corner[ax[1]]);
  const a=at(s1),b=at(s2),c=at([s1[0]+s2[0],s1[1]+s2[1],s1[2]+s2[2]]);
  return AO_LEVEL[(a&&b)?0:3-((a?1:0)+(b?1:0)+(c?1:0))];
}
function geometry(cells,size,occupied){const set=new Set(cells.map(c=>c.join(','))),verts=[],normals=[],uv=[],col=[];
const center=new T.Vector3();cells.forEach(c=>center.add(new T.Vector3(...c)));center.divideScalar(cells.length);
for(const c of cells)for(const[d,corners]of FACES){if(set.has(c.map((v,i)=>v+d[i]).join(',')))continue;
for(const k of [0,1,2,0,2,3]){const p=corners[k].map((v,i)=>(v+c[i]-center.getComponent(i))*.975+center.getComponent(i)-(size-1)/2);
verts.push(...p);normals.push(...d);uv.push((c[0]+corners[k][0]+c[2]+corners[k][2])*.24,(c[1]+corners[k][1])*.24);
const a=occupied?vertexAO(c,d,corners[k],occupied):1;col.push(a,a,a);}}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g;}
// every cell still on the board, which is what AO is computed against
function occupancy(){const o=new Set();for(const p of puzzle.pieces)if(!p.removed)for(const c of p.cells)o.add(c.join(','));return o;}
function rebuildAO(){const occ=occupancy();for(const p of puzzle.pieces){if(p.removed)continue;
const g=geometry(p.cells,puzzle.size,occ);p.mesh.geometry.dispose();p.mesh.geometry=g;
const e=p.mesh.getObjectByName('edges');if(e){e.geometry.dispose();e.geometry=new T.EdgesGeometry(g,20);}}}
// --- the viewport, measured in ONE place ---------------------------------
// games/CLAUDE.md § Canvas sizing: sizing the backing store from
// innerWidth/innerHeight while taps are read off clientX/clientY uses two
// coordinate spaces that iOS makes disagree. Safari's chrome can leave the
// canvas box SHORTER than innerHeight, CSS squashes the taller backing store
// into it, and every piece is drawn higher than it is hit-tested — by an
// offset that GROWS with y, so it reads as "the bottom of the cube stopped
// answering taps" while the top looks fine. Reproduced here at 0.711 squash.
// Cure #1, measure the element: viewBox() is the only place a layout number
// comes from, and fit() and tap() both read it.
const canvas=$('game');
function viewBox(){const r=canvas.getBoundingClientRect();
  // a hidden or not-yet-laid-out element measures as ZERO, and a zero box
  // would divide every ray by nothing; fall back rather than propagate it
  return r.width>0&&r.height>0?{x:r.left,y:r.top,w:r.width,h:r.height}
                              :{x:0,y:0,w:innerWidth,h:innerHeight};}
let boxW=0,boxH=0;
// setSize's third argument is updateStyle: false leaves the CSS box to
// 100vw/100dvh, so the box keeps tracking the real viewport and the backing
// store follows the box rather than the two being pinned to each other at
// whatever innerHeight said last. fit() is a pure function of the box, so
// calling it again with the same box changes nothing.
function fit(){const b=viewBox();boxW=b.w;boxH=b.h;renderer.setSize(b.w,b.h,false);camera.aspect=b.w/b.h;camera.position.set(0,0,(puzzle?.size||4)*2.65/Math.min(1,camera.aspect)*zoom);camera.lookAt(0,0,0);camera.updateProjectionMatrix();}
// iOS can hand a rotation a stale box and then never fire again, so measure
// on everything that could move it and once more per frame. Every pass is a
// strict no-op once the box settles.
function reflow(){const b=viewBox();if(b.w!==boxW||b.h!==boxH)fit();}
addEventListener('resize',reflow);
addEventListener('orientationchange',()=>{reflow();setTimeout(reflow,120);setTimeout(reflow,400);});
if(window.visualViewport){visualViewport.addEventListener('resize',reflow);visualViewport.addEventListener('scroll',reflow);}
function newPuzzle(){root.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});root.clear();puzzle=generatePuzzle(count);const occ0=new Set();for(const p of puzzle.pieces)for(const c of p.cells)occ0.add(c.join(','));
for(const p of puzzle.pieces){const g=geometry(p.cells,puzzle.size,occ0);p.mesh=new T.Mesh(g,mat(p.id,g.boundingSphere.radius));p.mesh.userData.piece=p;p.mesh.castShadow=!['jello','honey','ice'].includes(s.material);p.mesh.receiveShadow=true;const edges=new T.LineSegments(new T.EdgesGeometry(g,20),edgeMat(p.id));edges.name='edges';p.mesh.add(edges);root.add(p.mesh);}root.rotation.set(.38,-.65,.12);arrival=performance.now();locked=false;zoom=1;fit();}newPuzzle();
function updateMaterials(){const glass=['jello','honey','ice'].includes(s.material);for(const p of puzzle.pieces){p.mesh.material.dispose();p.mesh.material=mat(p.id,p.mesh.geometry.boundingSphere.radius);p.mesh.castShadow=!glass;const e=p.mesh.getObjectByName('edges');if(e){e.material.dispose();e.material=edgeMat(p.id);}}}
let sparks=null;function celebrate(){locked=true;const next=Math.min(s.max,Math.max(s.min,count+1));$('completed').textContent=count;$('next').textContent=next;$('success').classList.remove('celebrate');void $('success').offsetWidth;$('success').classList.add('celebrate');const pos=[],vel=[],colors=[];for(let b=0;b<5;b++){const x=(Math.random()-.5)*9,y=(Math.random()-.3)*6;const color=new T.Color().setHSL(b/5,.7,.65);for(let i=0;i<60;i++){pos.push(x,y,1);const v=new T.Vector3().randomDirection().multiplyScalar(2+Math.random()*4);vel.push(v.x,v.y,v.z);colors.push(color.r,color.g,color.b);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));sparks={mesh:new T.Points(g,new T.PointsMaterial({size:.055,vertexColors:true,transparent:true,depthTest:false,blending:T.AdditiveBlending})),vel,start:performance.now()};scene.add(sparks.mesh);sound.firework();setTimeout(()=>{scene.remove(sparks.mesh);sparks.mesh.geometry.dispose();sparks.mesh.material.dispose();sparks=null;count=next;newPuzzle();},1000);}
function tap(x,y){if(locked||$('settings').open)return;const b=viewBox();pointer.set((x-b.x)/b.w*2-1,-(y-b.y)/b.h*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(puzzle.pieces.filter(p=>!p.removed&&!p.busy).map(p=>p.mesh),false)[0];if(!hit)return;const p=hit.object.userData.piece;const dir=[p.dir,...directions].find(d=>canSlide(p,d,puzzle.pieces));p.busy=true;sound.effect(!!dir,s.material==='rust'?'metal':s.material);animations.push({p,dir:dir||p.dir,start:performance.now(),ok:!!dir});}
const fingers=new Map();let gesture=null,lastPinch=0;canvas.addEventListener('pointerdown',e=>{sound.start();canvas.setPointerCapture(e.pointerId);fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(fingers.size===1)gesture={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:0,multi:false};else{gesture.multi=true;lastPinch=pinch();}});function pinch(){const a=[...fingers.values()];return a.length<2?0:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}canvas.addEventListener('pointermove',e=>{if(!fingers.has(e.pointerId))return;fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(fingers.size>1){const d=pinch();if(lastPinch)zoom=Math.max(.65,Math.min(1.7,zoom*lastPinch/d));lastPinch=d;fit();return;}if(!gesture)return;const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;gesture.moved=Math.max(gesture.moved,Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y));if(gesture.moved>5){const q=new T.Quaternion().setFromEuler(new T.Euler(dy*.007,dx*.007,0));root.quaternion.premultiply(q);}gesture.lastX=e.clientX;gesture.lastY=e.clientY;});canvas.addEventListener('pointerup',e=>{if(gesture&&!gesture.multi&&gesture.moved<7)tap(e.clientX,e.clientY);fingers.delete(e.pointerId);if(!fingers.size)gesture=null;});canvas.addEventListener('pointercancel',e=>{fingers.delete(e.pointerId);gesture=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.7,zoom+e.deltaY*.001));fit();},{passive:false});canvas.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();root.rotation.y+=e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0;root.rotation.x+=e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0;}if(e.key==='Enter'||e.key===' '){e.preventDefault();sound.start();const b=viewBox();tap(b.x+b.w/2,b.y+b.h/2);}});
function choices(container,values,key,onChange){for(const [value,label,color]of values){const b=document.createElement('button');b.type='button';b.className='choice';b.dataset.value=value;b.setAttribute('aria-pressed',s[key]===value);if(color){const sw=document.createElement('span');sw.className='swatch';sw.style.background=color;b.append(sw);}b.append(document.createTextNode(label));b.onclick=()=>{s[key]=value;container.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',el.dataset.value===value));onChange();save();};container.append(b);}}
choices($('materials'),materials,'material',updateMaterials);choices($('backgrounds'),[['none','None'],['meadow','Meadow'],['mountains','Mountains'],['beach','Beach'],['arctic','Arctic']],'background',()=>{world.set(s.background);sound.bg=s.background;});for(const k of ['master','effects','ambient']){$(k).value=s[k];$(k+'Value').value=s[k]+'%';$(k).oninput=()=>{s[k]=+$(k).value;$(k+'Value').value=s[k]+'%';sound.update();save();};}for(const k of ['min','max'])$(k).value=s[k];function commitBounds(changed){let min=bound($('min').value,5),max=bound($('max').value,20);if(min>max){if(changed==='max')min=max;else max=min;}s.min=min;s.max=max;for(const k of ['min','max'])$(k).value=s[k];save();}for(const k of ['min','max'])$(k).addEventListener('blur',()=>commitBounds(k));// --- standard chrome: mute and reload. Both wake the AudioContext first: on
// iOS the first gesture is usually one of these buttons, not the canvas.
const muteBtn=$('mute-btn');function paintMute(){muteBtn.textContent=s.muted?'\uD83D\uDD07':'\uD83D\uDD0A';muteBtn.setAttribute('aria-label',s.muted?'Unmute':'Mute');}paintMute();
muteBtn.onclick=()=>{sound.start();s.muted=!s.muted;paintMute();sound.update();save();};
// A fresh puzzle at the current size — the way out of one you do not like.
// Animations are dropped first so the frame loop cannot touch a disposed mesh.
$('reload-btn').onclick=()=>{sound.start();if(locked)return;animations.length=0;newPuzzle();};
document.addEventListener('visibilitychange',()=>{if(!sound.ctx)return;document.hidden?sound.ctx.suspend():sound.ctx.resume();});
$('settingsButton').onclick=()=>{sound.start();$('settings').showModal();};$('settings').addEventListener('close',()=>{commitBounds();$('settingsButton').focus();});$('settings').addEventListener('click',e=>{if(e.target===$('settings')){const r=$('settings').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('settings').close();}});
function frame(now){reflow();const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;const t=(now-clockStart)/1000;const day=world.tick(t);sound.tick(t,day);renderer.toneMappingExposure=1.02+(1-day)*0.58;const fade=Math.min(1,(now-arrival)/260);root.scale.setScalar(.85+.15*fade);root.visible=fade>.01;for(const p of puzzle.pieces){p.mesh.material.opacity=fade;const tr=fade<1;if(p.mesh.material.transparent!==tr){p.mesh.material.transparent=tr;p.mesh.material.needsUpdate=true;}}for(let i=animations.length-1;i>=0;i--){const a=animations[i],u=Math.min(1,(now-a.start)/(a.ok?650:260));const dist=a.ok?u*u*(puzzle.size*3+5):Math.sin(u*Math.PI*6)*.055*(1-u);a.p.mesh.position.set(...a.dir).multiplyScalar(dist);if(u===1){a.p.busy=false;if(a.ok){a.p.removed=true;a.p.mesh.visible=false;rebuildAO();}else a.p.mesh.position.set(0,0,0);animations.splice(i,1);if(a.ok&&puzzle.pieces.every(p=>p.removed))celebrate();}}if(sparks){const a=sparks.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){a.setXYZ(i,a.getX(i)+sparks.vel[i*3]*dt,a.getY(i)+sparks.vel[i*3+1]*dt,a.getZ(i)+sparks.vel[i*3+2]*dt);sparks.vel[i*3+1]-=3*dt;}a.needsUpdate=true;sparks.mesh.material.opacity=Math.max(0,1-(now-sparks.start)/1000);}renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Read-only diagnostics for local validation.
// pick() and ndcOf() exist so a gate can prove taps land where pieces are
// DRAWN. ndcOf() is deliberately box-free — camera projection only — so a
// test can map it to a screen point through the canvas rect it measured
// itself, and pick() then has to agree without either side sharing the
// helper under test.
window.interlock={
  box(){return viewBox();},
  ndcOf(id){const p=puzzle.pieces.find(q=>q.id===id);if(!p||p.removed)return null;
    root.updateMatrixWorld(true);
    const v=p.mesh.geometry.boundingSphere.center.clone();p.mesh.localToWorld(v);
    v.project(camera);return {x:v.x,y:v.y};},
  pick(x,y){const b=viewBox(),v=new T.Vector2((x-b.x)/b.w*2-1,-(y-b.y)/b.h*2+1),r=new T.Raycaster();
    r.setFromCamera(v,camera);
    const hit=r.intersectObjects(puzzle.pieces.filter(q=>!q.removed).map(q=>q.mesh),false)[0];
    return hit?hit.object.userData.piece.id:null;},
  // The light rig, so the "sun and moon and nothing else" contract is
  // assertable rather than eyeballed: any fill light someone adds later shows
  // up here as a third entry.
  // The ONLY diagnostic here that writes anything: winds the 24-minute day
  // cycle to a given second so a gate can check the night rig without waiting
  // twelve minutes for it. Nothing in the game calls it.
  /* --- the three writers, all test-only; nothing in the game calls them.
   * They exist so a gate can prove a rendering property CAUSALLY (turn the
   * feature off, see the pixels move) instead of comparing two materials and
   * hoping the difference came from the thing under test — a cross-material
   * comparison put opaque pine ABOVE two of the three glasses on interior
   * detail, because wood grain is high-frequency too (2026-09-20). */
  clock(sec){clockStart=performance.now()-sec*1000;return sec;},
  // The other writer, also test-only: lets a gate prove shadows change
  // pixels rather than only that the flags are set.
  shadows(on){renderer.shadowMap.enabled=!!on;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});return !!on;},
  transmission(on){for(const p of puzzle.pieces){const m=p.mesh.material;
    if(on){if(m.userData.tSave!==undefined){m.transmission=m.userData.tSave;delete m.userData.tSave;}}
    else if(m.transmission>0){m.userData.tSave=m.transmission;m.transmission=0;}
    m.needsUpdate=true;}return !!on;},
  edges(){const e=puzzle.pieces[0].mesh.getObjectByName('edges');
    return e?{transparent:e.material.transparent,opacity:e.material.opacity,
      color:'#'+e.material.color.getHexString()}:null;},
  rig(){const lights=[];scene.traverse(o=>{if(o.isLight)lights.push({type:o.type,
    intensity:+o.intensity.toFixed(4),castShadow:!!o.castShadow,
    shadowMap:!!(o.shadow&&o.shadow.map)});});
    return {lights,shadowMapEnabled:renderer.shadowMap.enabled,
      environment:!!scene.environment,
      environmentIntensity:scene.environmentIntensity,
      exposure:+renderer.toneMappingExposure.toFixed(3),
      casters:puzzle.pieces.filter(p=>p.mesh.castShadow).length,
      receivers:puzzle.pieces.filter(p=>p.mesh.receiveShadow).length};},
  get audio(){return sound.ctx?{muted:s.muted,master:sound.master.gain.value,effects:sound.fx.gain.value,ambient:sound.amb.gain.value}:null;},get state(){return {count,remaining:puzzle.pieces.filter(p=>!p.removed).length,settings:{...s},pieces:puzzle.pieces.map(p=>({id:p.id,removed:!!p.removed,free:directions.some(d=>canSlide(p,d,puzzle.pieces))}))};}};
