import * as THREE from '../vendor/three.module.js';

const $ = id => document.getElementById(id);
const count = 10;
const museum = $('sergi');
const intro = $('acilis');
const outro = $('kapanis');
const exhibitEnd = .82;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const firstNames = ['Kentsel Tasarım','Hareketlilik','Erişilebilirlik','Aktarma','Yaya Alanı','Bisiklet','Kamusal Alan','İstasyon','Teknoloji','Entegrasyon'];
const starter = Array.from({length:count},(_,i)=>({
  id:String(i+1).padStart(2,'0'),
  title:`Proje ${String(i+1).padStart(2,'0')}`,
  category:firstNames[i],
  description:'Bu durak bir örnek proje alanıdır. Gerçek proje görselini ve doğrulanmış açıklamasını koleksiyon düzenleyicisinden ekleyebilirsiniz.',
  technologies:[],role:'Belirtilmedi',year:'—',image:''
}));
let projects = structuredClone(starter);
let activeIndex=0, editIndex=0, sceneReady=false, sceneFailed=false;
let scrollMuseum=0, wantRender=true, isMuseumVisible=false, noticeTimer;
let renderer,scene,camera,raycaster,posterMeshes=[],posterTextures=[],renderLoop=0,focusX=0;
let doorLeaves=[],doorOpen=0,freeMode=false,freeYaw=0,freePitch=0,freeX=0,freeZ=0,dragLook=false,draggedLook=false,hadPointerLock=false;
const moveKeys=new Set();
const pointer={x:0,y:0};
let lastFrame=performance.now();

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function smoothstep(a,b,v){const x=clamp((v-a)/(b-a),0,1);return x*x*(3-2*x);}
function announce(message){const el=$('notice');el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true;},5500);}
function openDialog(id){if(freeMode)exitFreeMode();const el=$(id);if(!el.open)el.showModal();document.body.classList.add('dialog-open');}
function closeDialog(id){const el=$(id);if(el.open)el.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');}
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.close)));
document.querySelectorAll('dialog').forEach(el=>el.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');}));

function sectionProgress(el){
  const max=Math.max(1,el.offsetHeight-innerHeight);
  return clamp(-el.getBoundingClientRect().top/max,0,1);
}
function makeScrubber(video,section,progressEl){
  let desired=0, seeking=false,ready=false;
  const pump=()=>{
    if(!ready||seeking||Math.abs(video.currentTime-desired)<.038)return;
    seeking=true;
    try{video.currentTime=desired;}catch{seeking=false;}
  };
  video.addEventListener('loadedmetadata',()=>{ready=Number.isFinite(video.duration)&&video.duration>0;sync(sectionProgress(section));});
  video.addEventListener('seeked',()=>{seeking=false;if(Math.abs(desired-video.currentTime)>.055)pump();});
  video.addEventListener('error',()=>{section.classList.add('video-error');announce('Video açılamadı. Kaynak dosyanın aynı klasörde olduğunu kontrol edin.');},{once:true});
  video.pause();
  function sync(progress){
    progressEl.style.width=`${(progress*100).toFixed(2)}%`;
    if(!ready)return;
    desired=clamp(progress*(video.duration-.055),0,video.duration-.055);
    pump();
  }
  return sync;
}
const syncIntro=makeScrubber($('intro-video'),intro,$('intro-progress'));
const syncOutro=makeScrubber($('outro-video'),outro,$('outro-progress'));

function scrollToProject(index){
  const p=clamp((index+.5)/count*exhibitEnd,0,exhibitEnd);
  const max=museum.offsetHeight-innerHeight;
  scrollTo({top:museum.offsetTop+p*max,behavior:reduceMotion?'instant':'smooth'});
}
function updateNavigation(){
  const rail=$('stop-rail');rail.replaceChildren();
  projects.forEach((project,index)=>{
    const button=document.createElement('button');button.type='button';button.textContent=String(index+1).padStart(2,'0');
    button.title=`${index+1}. ${project.title}`;button.setAttribute('aria-label',`${index+1}. durak: ${project.title}`);
    button.addEventListener('click',()=>scrollToProject(index));rail.append(button);
  });
  const fallback=$('fallback-list');fallback.replaceChildren();
  projects.forEach((project,index)=>{const button=document.createElement('button');button.type='button';const b=document.createElement('b'),small=document.createElement('small');b.textContent=`${index+1}. ${project.title}`;small.textContent=project.category;button.append(b,small);button.addEventListener('click',()=>showProject(index));fallback.append(button);});
  refreshStopUI();
}
function refreshStopUI(){
  $('current-stop-title').textContent=`${String(activeIndex+1).padStart(2,'0')} · ${projects[activeIndex].title}`;
  $('stop-rail').querySelectorAll('button').forEach((button,index)=>{button.classList.toggle('is-active',index===activeIndex);button.setAttribute('aria-current',index===activeIndex?'step':'false');});
  $('prev-stop').disabled=activeIndex===0;$('next-stop').disabled=activeIndex===count-1;
}
$('prev-stop').addEventListener('click',()=>scrollToProject(activeIndex-1));
$('next-stop').addEventListener('click',()=>scrollToProject(activeIndex+1));

function onScroll(){
  const introProgress=sectionProgress(intro),outroProgress=sectionProgress(outro);
  scrollMuseum=sectionProgress(museum);
  if(freeMode&&(scrollMuseum>=exhibitEnd||museum.getBoundingClientRect().bottom<=0))exitFreeMode();
  const exhibitProgress=clamp(scrollMuseum/exhibitEnd,0,1);
  doorOpen=smoothstep(.89,.99,scrollMuseum);
  syncIntro(introProgress);syncOutro(outroProgress);
  $('museum-progress').style.width=`${(scrollMuseum*100).toFixed(2)}%`;
  $('intro-end').classList.toggle('is-visible',introProgress>.9);
  $('intro-end').setAttribute('aria-hidden',String(introProgress<=.9));
  document.querySelector('.intro-copy').style.opacity=String(clamp(1-introProgress*3.3,0,1));
  document.querySelector('.outro-copy').style.opacity=String(clamp((outroProgress-.61)*3.1,0,1));
  document.querySelector('.museum-head').style.opacity=String(clamp(1-scrollMuseum*6,0,1));
  const slogan=$('door-slogan');slogan.style.opacity=String(smoothstep(.925,.96,scrollMuseum)*(1-smoothstep(.982,.995,scrollMuseum)));slogan.classList.toggle('is-visible',scrollMuseum>.925&&scrollMuseum<.995);slogan.setAttribute('aria-hidden',String(scrollMuseum<=.925||scrollMuseum>=.995));
  $('museum-to-film').style.opacity=String(smoothstep(.984,1,scrollMuseum));
  museum.classList.toggle('door-sequence',scrollMuseum>.865);
  const next=clamp(Math.floor(exhibitProgress*count),0,count-1);
  if(next!==activeIndex){activeIndex=next;refreshStopUI();}
  wantRender=true;
  if(!sceneReady && !sceneFailed && museum.getBoundingClientRect().top<innerHeight*1.3)initScene();
}
let scrollPending=false;
window.addEventListener('scroll',()=>{if(scrollPending)return;scrollPending=true;requestAnimationFrame(()=>{scrollPending=false;onScroll();});},{passive:true});
window.addEventListener('resize',()=>{resizeScene();onScroll();});
function exitFreeMode(){freeMode=false;dragLook=false;draggedLook=false;moveKeys.clear();$('free-roam').setAttribute('aria-pressed','false');$('free-roam').innerHTML='SERBEST GEZİNTİ <span>WASD + FARE ↗</span>';museum.querySelector('.museum-stage').classList.remove('free-active');if(document.pointerLockElement=== $('museum-canvas'))document.exitPointerLock();wantRender=true;}
function enterFreeMode(){if(!sceneReady||sceneFailed||scrollMuseum>=exhibitEnd){announce('Önce tramvay sergisine geçin.');return;}if(!matchMedia('(pointer:fine)').matches){announce('Serbest gezinti fare ve klavyeli bilgisayarda kullanılabilir.');return;}freeMode=true;freeX=clamp(camera.position.x,-.8,.8);freeZ=clamp(camera.position.z,-13.7,13.7);freeYaw=Math.atan2(focusX-freeX,4.4);freePitch=0;$('free-roam').setAttribute('aria-pressed','true');$('free-roam').innerHTML='SUNUMA DÖN <span>ESC ↗</span>';museum.querySelector('.museum-stage').classList.add('free-active');try{const lock=$('museum-canvas').requestPointerLock?.();lock?.catch?.(()=>announce('Fare kilitlenemedi. Kamerayı fareyle sürükleyerek döndürebilirsiniz.'));}catch{announce('Fare kilitlenemedi. Kamerayı fareyle sürükleyerek döndürebilirsiniz.');}wantRender=true;}
$('free-roam').addEventListener('click',()=>freeMode?exitFreeMode():enterFreeMode());
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===$('museum-canvas'))hadPointerLock=true;else if(hadPointerLock){hadPointerLock=false;if(freeMode)exitFreeMode();}});
document.addEventListener('mousemove',e=>{if(!freeMode||document.pointerLockElement!==$('museum-canvas'))return;freeYaw+=e.movementX*.0024;freePitch=clamp(freePitch-e.movementY*.0024,-1.35,1.35);wantRender=true;});
document.addEventListener('pointerup',()=>{dragLook=false;});
window.addEventListener('blur',()=>{moveKeys.clear();dragLook=false;});
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  if(freeMode){if(e.key==='Escape'){exitFreeMode();return;}const key=e.key.toLowerCase();if(['w','a','s','d','shift'].includes(key)){e.preventDefault();moveKeys.add(key);return;}if(key==='e'){e.preventDefault();inspectFocusedProject();return;}return;}
  if(e.key==='ArrowRight'&&sectionProgress(museum)>0&&sectionProgress(museum)<1){e.preventDefault();scrollToProject(activeIndex+1);}
  if(e.key==='ArrowLeft'&&sectionProgress(museum)>0&&sectionProgress(museum)<1){e.preventDefault();scrollToProject(activeIndex-1);}
  if(e.key==='Enter'&&sectionProgress(museum)>0&&sectionProgress(museum)<1)showProject(activeIndex);
});
window.addEventListener('keyup',e=>moveKeys.delete(e.key.toLowerCase()));

function makeMaterial(color,roughness=.65,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function box(w,h,d,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function tube(from,to,radius,material,parent=scene){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),dir=end.clone().sub(start);const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,dir.length(),10),material);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(m);return m;}
function floorTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#495553';ctx.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=20){ctx.fillStyle=(y/20)%2?'#4b5755':'#46514f';ctx.fillRect(0,y,512,18);ctx.strokeStyle='#71807a44';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
  for(let i=0;i<480;i++){ctx.fillStyle=`rgba(216,226,215,${(i%4+1)*.012})`;ctx.fillRect((i*79)%512,(i*173)%512,1,1);}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,12);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function seat(z,side,mat,railMat){
  const x=side*1.36;
  box(.93,.13,1.02,x,.47,z,mat);
  box(.95,.93,.11,side*1.78,.92,z,mat);
  box(.95,.18,1.05,x,.31,z,railMat);
  tube([x-.31,.36,z-.38],[x-.31,.13,z-.38],.025,railMat);
  tube([x+.31,.36,z+.38],[x+.31,.13,z+.38],.025,railMat);
}
function makePosterTexture(project,index){
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=560;const ctx=canvas.getContext('2d');
  const colors=[['#dceae1','#325b61','#acc7aa'],['#e6ddd1','#504f66','#c6af85'],['#d5e6e8','#226472','#b2d4cb']];
  const [paper,ink,accent]=colors[index%colors.length];ctx.fillStyle=paper;ctx.fillRect(0,0,800,560);
  ctx.strokeStyle=ink;ctx.globalAlpha=.12;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(-60,130+i*58);ctx.bezierCurveTo(130+i*10,60,380,510-i*14,840,250+i*35);ctx.lineWidth=i===2?16:4;ctx.stroke();}ctx.globalAlpha=1;
  ctx.fillStyle=accent;ctx.fillRect(38,36,132,6);ctx.fillStyle=ink;ctx.font='700 26px Segoe UI,Arial';ctx.fillText('ÖRNEK / PROJE',38,95);
  ctx.fillStyle=ink;ctx.font='400 190px Georgia';ctx.fillText(String(index+1).padStart(2,'0'),35,374);
  ctx.fillStyle=ink;ctx.font='700 32px Segoe UI,Arial';ctx.fillText(project.title.slice(0,31),40,490,705);
  ctx.font='500 21px Segoe UI,Arial';ctx.fillText(project.category.toUpperCase(),42,526,650);
  if(project.image){
    const image=new Image();image.onload=()=>{ctx.fillStyle='#dde6e0';ctx.fillRect(0,0,800,560);const ratio=Math.min(800/image.width,560/image.height);const w=image.width*ratio,h=image.height*ratio;ctx.drawImage(image,(800-w)/2,(560-h)/2,w,h);texture.needsUpdate=true;wantRender=true;};image.src=project.image;
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function refreshPosters(onlyIndex){if(!sceneReady)return;posterMeshes.forEach((mesh,index)=>{if(onlyIndex!==undefined&&index!==onlyIndex)return;posterTextures[index]?.dispose();const texture=makePosterTexture(projects[index],index);mesh.material.map=texture;mesh.material.needsUpdate=true;posterTextures[index]=texture;});wantRender=true;}
function createCarriage(){
  const mat={floor:new THREE.MeshStandardMaterial({map:floorTexture(),roughness:.93}),wall:makeMaterial('#e6e8e3'),ceiling:makeMaterial('#e8e8df'),trim:makeMaterial('#b9c9c3',.55,.2),dark:makeMaterial('#25343a',.55,.24),seat:makeMaterial('#316756',.94),seatAlt:makeMaterial('#66956f',.9),pole:makeMaterial('#c4c9bd',.28,.83),yellow:makeMaterial('#dfb967',.4,.1),glass:new THREE.MeshPhysicalMaterial({color:'#a9d7dc',roughness:.12,metalness:.12,transmission:.26,transparent:true,opacity:.36,side:THREE.DoubleSide,depthWrite:false})};
  scene.background=new THREE.Color('#c9dedb');
  box(3.8,.14,31,0,-.09,-.25,mat.floor);
  for(const side of [-1,1]){
    box(.10,.92,31,side*1.93,.46,-.25,mat.wall);
    box(.13,.31,31,side*1.93,2.81,-.25,mat.wall);
    box(.12,.10,31,side*1.93,1.07,-.25,mat.dark);
    box(.08,.08,31,side*1.91,2.61,-.25,mat.trim);
    for(let z=14.8;z>-15;z-=3.5){
      box(.035,1.49,3.12,side*1.96,1.83,z-1.58,mat.glass);
      box(.14,1.52,.055,side*1.96,1.83,z,mat.dark);
      box(.12,.06,3.12,side*1.96,2.59,z-1.58,mat.dark);
      box(.12,.08,3.12,side*1.96,1.08,z-1.58,mat.dark);
      box(.08,.22,3.5,side*1.83,2.87,z-1.7,mat.yellow);
    }
    // Distant, quiet urban masses give the windows depth without claiming a real alignment.
    for(let z=-16;z<20;z+=3.1){const height=1.1+((Math.abs(Math.round(z*7))%5)*.18);box(.9,height,2.3,side*4.8,height/2-.08,z,makeMaterial(z%2?'#8daaa7':'#a9bab5'));}
  }
  box(3.65,.13,31,0,3.02,-.25,mat.ceiling);
  for(const side of [-1,1]){
    const slope=box(.34,.07,31,side*1.69,2.92,-.25,mat.ceiling);slope.rotation.z=side*.38;
    tube([side*.98,2.53,14.7],[side*.98,2.53,-15.2],.027,mat.pole);
    for(let z=13.4;z>-14;z-=3.1){
      tube([side*.98,2.53,z],[side*.98,1.17,z],.024,mat.pole);
      for(let h=-.9;h<1.1;h+=.83){const loop=new THREE.Mesh(new THREE.TorusGeometry(.11,.018,8,18),mat.yellow);loop.position.set(side*.98,2.22,z+h);scene.add(loop);tube([side*.98,2.53,z+h],[side*.98,2.32,z+h],.014,mat.pole);}
      seat(z-.55,side,((z*10|0)%2)?mat.seat:mat.seatAlt,mat.dark);
    }
  }
  for(let z=14;z>-14;z-=3){box(.11,.035,2.15,0,2.93,z-1.08,new THREE.MeshBasicMaterial({color:'#fff9e5'}));}
  for(const side of [-1,1])box(1.13,3,.12,side*1.335,1.45,-15.55,mat.dark);
  box(1.55,.66,.12,0,2.67,-15.55,mat.dark);
  box(1.5,.12,4.25,0,-.09,-17.64,mat.floor);
  for(const side of [-1,1])box(.08,2.5,4.25,side*.78,1.25,-17.64,mat.wall);
  box(1.58,.09,4.25,0,2.53,-17.64,mat.ceiling);
  box(1.5,2.5,.08,0,1.25,-19.78,new THREE.MeshBasicMaterial({color:'#244750'}));
  box(.78,.035,3.7,0,2.46,-17.7,new THREE.MeshBasicMaterial({color:'#fff7dc'}));
  box(1.56,.055,.07,0,2.54,-15.43,mat.yellow);
  for(const side of [-1,1])box(.055,2.36,.07,side*.77,1.35,-15.43,mat.yellow);
  doorLeaves=[];
  for(const side of [-1,1]){
    const leaf=new THREE.Group();leaf.position.set(side*.345,1.35,-15.40);scene.add(leaf);
    box(.69,2.31,.045,0,0,0,new THREE.MeshStandardMaterial({color:'#b6d2d0',roughness:.42,metalness:.15}),leaf);
    box(.05,2.25,.052,-side*.315,0,.025,mat.trim,leaf);
    box(.04,.42,.057,-side*.22,-.04,.032,mat.dark,leaf);
    doorLeaves.push(leaf);
  }
  box(3.8,.2,.09,0,2.73,-15.44,mat.yellow);
  const windowMat=new THREE.MeshBasicMaterial({color:'#d9f3f1',transparent:true,opacity:.38});
  for(const side of [-1,1])box(.03,2.1,1.9,side*3.3,1.6,-14.5,windowMat);
  posterMeshes=[];posterTextures=[];
  for(let i=0;i<count;i++){
    const side=i%2?-1:1,z=10.7-i*2.42,x=side*1.58,y=2.2;
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(group);
    box(1.36,.91,.065,0,0,0,mat.dark,group);
    box(1.23,.79,.032,0,0,.052,mat.yellow,group);
    const photo=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.73),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));photo.position.z=.076;photo.userData.projectIndex=i;group.add(photo);
    box(1.36,.07,.13,0,-.48,.01,mat.trim,group);
    const tinyLabel=new THREE.Mesh(new THREE.PlaneGeometry(1.36,.19),new THREE.MeshBasicMaterial({color:'#e2eee2',side:THREE.DoubleSide}));tinyLabel.position.set(0,-.64,.04);tinyLabel.userData.projectIndex=i;group.add(tinyLabel);
    posterMeshes.push(photo);
  }
  scene.add(new THREE.HemisphereLight('#effbf6','#587471',2.2));
  const key=new THREE.DirectionalLight('#fff8e8',2.2);key.position.set(-3,7,7);scene.add(key);
  for(const z of [11,3,-5,-13]){const light=new THREE.PointLight('#fff8e7',13,9,2);light.position.set(0,2.68,z);scene.add(light);}
}
function resizeScene(){if(!renderer||!camera)return;const canvas=$('museum-canvas');const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));camera.aspect=w/h;camera.updateProjectionMatrix();wantRender=true;}
function enableFallback(){sceneFailed=true;$('museum-fallback').hidden=false;$('museum-canvas').hidden=true;announce('3B görünüm kullanılamıyor; proje listesi açıldı.');}
function inspectFocusedProject(){if(!sceneReady)return;raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects(posterMeshes,false)[0];if(hit&&hit.distance<5.5)showProject(hit.object.userData.projectIndex);else announce('İncelemek için bir proje görseline bakın veya çerçeveye tıklayın.');}
function initScene(){
  if(sceneReady||sceneFailed)return;
  try{
    const canvas=$('museum-canvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.7;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(68,1,.08,200);camera.position.set(0,1.62,12.6);raycaster=new THREE.Raycaster();
    createCarriage();sceneReady=true;resizeScene();refreshPosters();
    canvas.addEventListener('pointerdown',e=>{if(freeMode&&document.pointerLockElement!==canvas){dragLook=true;draggedLook=false;canvas.dataset.dragX=String(e.clientX);canvas.dataset.dragY=String(e.clientY);}});
    canvas.addEventListener('pointermove',e=>{if(freeMode){if(dragLook&&document.pointerLockElement!==canvas){const dx=e.clientX-Number(canvas.dataset.dragX),dy=e.clientY-Number(canvas.dataset.dragY);if(Math.abs(dx)+Math.abs(dy)>3)draggedLook=true;freeYaw+=dx*.0024;freePitch=clamp(freePitch-dy*.0024,-1.35,1.35);canvas.dataset.dragX=String(e.clientX);canvas.dataset.dragY=String(e.clientY);wantRender=true;}return;}const r=canvas.getBoundingClientRect();pointer.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);pointer.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1);});
    canvas.addEventListener('pointerleave',()=>{pointer.x=0;pointer.y=0;dragLook=false;canvas.style.cursor='auto';});
    canvas.addEventListener('click',e=>{if(draggedLook){draggedLook=false;return;}const r=canvas.getBoundingClientRect();const p=freeMode&&document.pointerLockElement===canvas?new THREE.Vector2(0,0):new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));raycaster.setFromCamera(p,camera);const hit=raycaster.intersectObjects(posterMeshes,false)[0];if(hit&&hit.distance<6)showProject(hit.object.userData.projectIndex);});
    renderScene();
  }catch(error){console.error(error);enableFallback();}
}
function renderScene(now=performance.now()){
  if(!sceneReady)return;
  renderLoop=requestAnimationFrame(renderScene);
  const elapsed=Math.min(.5,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if((!isMuseumVisible&&!wantRender)||document.querySelector('dialog[open]'))return;
  const ease=reduceMotion?1:1-Math.exp(-elapsed/.08);
  if(freeMode){
    const speed=(moveKeys.has('shift')?3.7:2.35)*elapsed;
    const forward=Number(moveKeys.has('w'))-Number(moveKeys.has('s'));
    const strafe=Number(moveKeys.has('d'))-Number(moveKeys.has('a'));
    freeX=clamp(freeX+(Math.sin(freeYaw)*forward+Math.cos(freeYaw)*strafe)*speed,-.8,.8);
    freeZ=clamp(freeZ+(-Math.cos(freeYaw)*forward+Math.sin(freeYaw)*strafe)*speed,-13.7,13.7);
    camera.position.set(freeX,1.63,freeZ);
    camera.lookAt(freeX+Math.sin(freeYaw)*Math.cos(freePitch),1.63+Math.sin(freePitch),freeZ-Math.cos(freeYaw)*Math.cos(freePitch));
  }else{
    const exhibitProgress=clamp(scrollMuseum/exhibitEnd,0,1);
    const exhibitPosition=clamp(exhibitProgress*count-.5,0,count-1);
    const doorApproach=smoothstep(exhibitEnd,.94,scrollMuseum);
    const throughDoor=smoothstep(.965,1,scrollMuseum);
    const cameraZ=13.9-exhibitPosition*2.42-doorApproach*4.2-throughDoor*5;
    const targetX=(activeIndex%2?-1:1)*.16*(1-doorApproach)+pointer.x*.09;
    camera.position.z+=(cameraZ-camera.position.z)*ease;
    camera.position.x+=(targetX-camera.position.x)*ease;
    camera.position.y+=(1.63-pointer.y*.035-camera.position.y)*ease;
    const focusGoal=((activeIndex%2?-1:1)*(innerWidth<650?2:.52)+pointer.x*.13)*(1-doorApproach);
    focusX+=(focusGoal-focusX)*ease;
    camera.lookAt(focusX,1.67-pointer.y*.06,camera.position.z-4.4);
  }
  doorLeaves.forEach((leaf,index)=>{leaf.position.x=(index===0?-1:1)*(.345+doorOpen*.72);});
  $('museum-canvas').dataset.cameraZ=camera.position.z.toFixed(3);
  $('museum-canvas').dataset.yaw=freeYaw.toFixed(3);
  $('museum-canvas').dataset.doorOpen=doorOpen.toFixed(3);
  renderer.render(scene,camera);wantRender=false;
}
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===museum){isMuseumVisible=entry.isIntersecting;wantRender=true;if(isMuseumVisible&&!sceneReady&&!sceneFailed)initScene();}},{rootMargin:'70% 0px'});observer.observe(museum);

function showProject(index){
  const project=projects[index];if(!project)return;
  $('detail-kicker').textContent=`DURAK ${String(index+1).padStart(2,'0')} / 10 · ${project.category.toUpperCase()}`;
  $('detail-title').textContent=project.title;$('detail-description').textContent=project.description;
  $('detail-category').textContent=project.category;$('detail-year').textContent=project.year;$('detail-role').textContent=project.role;
  const tags=$('detail-tags');tags.replaceChildren();project.technologies.forEach(tag=>{const span=document.createElement('span');span.textContent=tag;tags.append(span);});
  $('detail-image').removeAttribute('src');if(project.image)$('detail-image').src=project.image;
  $('detail-image').alt=project.title;$('detail-edit').onclick=()=>{closeDialog('project-dialog');editIndex=index;populateEditor();openDialog('editor-dialog');};
  openDialog('project-dialog');
}
$('edit-open').addEventListener('click',()=>{editIndex=activeIndex;populateEditor();openDialog('editor-dialog');});
function populateEditor(){
  const select=$('project-picker');select.replaceChildren();projects.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${String(i+1).padStart(2,'0')} · ${p.title}`;select.append(o);});
  select.value=String(editIndex);const p=projects[editIndex];
  $('project-title').value=p.title;$('project-category').value=p.category;$('project-year').value=p.year;
  $('project-description').value=p.description;$('project-role').value=p.role;$('project-tags').value=p.technologies.join(', ');
  $('editor-image').removeAttribute('src');if(p.image)$('editor-image').src=p.image;
}
$('project-picker').addEventListener('change',e=>{editIndex=Number(e.target.value);populateEditor();});
let saveTimer;
function changed(field,value){
  projects[editIndex][field]=value;
  clearTimeout(saveTimer);$('save-status').textContent='Kaydediliyor…';
  saveTimer=setTimeout(async()=>{try{await saveToDB(projects);$('save-status').textContent='Bu tarayıcıya kaydedildi. Taşımak için JSON indirin.';}catch{$('save-status').textContent='Yerel kayıt başarısız. JSON yedeği indirin.';}},500);
  if(field==='title'||field==='category')updateNavigation();
  if(field==='title'||field==='category'||field==='image')refreshPosters(editIndex);
}
for(const [id,field] of [['project-title','title'],['project-category','category'],['project-year','year'],['project-description','description'],['project-role','role']])$(id).addEventListener('input',e=>changed(field,e.target.value));
$('project-tags').addEventListener('input',e=>changed('technologies',e.target.value.split(',').slice(0,15).map(t=>t.trim().slice(0,100)).filter(Boolean)));
$('image-input').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024){announce('PNG, JPG veya WebP seçin. Dosya en fazla 20 MB olmalı.');return;}
  try{const bitmap=await createImageBitmap(file);const factor=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/jpeg',.86);changed('image',data);$('editor-image').src=data;announce('Görsel projeye eklendi.');}catch{announce('Görsel dosyası işlenemedi.');}
});
$('reset-project').addEventListener('click',()=>{projects[editIndex]=structuredClone(starter[editIndex]);populateEditor();changed('image','');announce('Seçili durak örnek içeriğe döndü.');});
function validateCollection(data){
  if(!data||data.version!==1||!Array.isArray(data.projects)||data.projects.length!==count)throw Error('10 projelik müze JSON kaydı seçin.');
  return data.projects.map((p,i)=>{
    if(!p||typeof p!=='object')throw Error('Proje kaydı geçersiz.');
    for(const k of ['title','category','description','year','role','image'])if(typeof p[k]!=='string')throw Error(`Proje alanı geçersiz: ${k}`);
    if(!Array.isArray(p.technologies)||p.technologies.some(v=>typeof v!=='string')||p.technologies.length>15)throw Error('Etiket listesi geçersiz.');
    if(p.image&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image))throw Error('Görsel verisi desteklenmiyor.');
    return{id:String(i+1).padStart(2,'0'),title:p.title.slice(0,100),category:p.category.slice(0,80),description:p.description.slice(0,3000),year:p.year.slice(0,20),role:p.role.slice(0,160),technologies:p.technologies.slice(0,15).map(v=>v.slice(0,100)),image:p.image};
  });
}
function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open('ornek-tramvay-scroll-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('collection');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function loadFromDB(){const conn=await db();return new Promise((resolve,reject)=>{const req=conn.transaction('collection').objectStore('collection').get('current');req.onsuccess=()=>{conn.close();resolve(req.result?validateCollection(req.result):null);};req.onerror=()=>{conn.close();reject(req.error);};});}
async function saveToDB(collection){const conn=await db();return new Promise((resolve,reject)=>{const tx=conn.transaction('collection','readwrite');tx.objectStore('collection').put({version:1,projects:collection},'current');tx.oncomplete=()=>{conn.close();resolve();};tx.onerror=()=>{conn.close();reject(tx.error);};});}
$('export-json').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,projects})],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ornek-tramvay-scroll-projeleri.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);announce('Proje görselleriyle birlikte JSON olarak indirildi.');});
$('import-json').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const collection=validateCollection(JSON.parse(await file.text()));projects=collection;await saveToDB(projects);populateEditor();updateNavigation();refreshPosters();announce('10 proje içe aktarıldı.');}catch(error){announce('JSON açılamadı: '+error.message);}});
async function boot(){try{const stored=await loadFromDB();if(stored)projects=stored;}catch{announce('Yerel kayıt okunamadı. JSON yedeği açabilirsiniz.');}updateNavigation();onScroll();}
boot();
