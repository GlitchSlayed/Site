/** Small decorative WebGL surface. Geometry and all useful text remain server-rendered SVG/HTML. */
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;uniform vec2 resolution;uniform float time;uniform float dark;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=uv*resolution;float grain=noise(floor(p));float fiber=sin(p.y*.72+noise(vec2(floor(p.y),2.))*3.);float sheen=pow(max(0.,1.-abs(uv.x*.8+uv.y*.24-.35-sin(time*.12)*.12)),8.);float alpha=.035+grain*.055+fiber*.012+sheen*.10;vec3 ink=mix(vec3(.29,.25,.18),vec3(.78,.70,.55),dark);gl_FragColor=vec4(ink,alpha);}`;
export function initTechnicalSurfaces(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=true;
 try{enabled=localStorage.getItem('drawing-texture')!=='off';}catch{}
 document.documentElement.dataset.texture=enabled?'on':'off';
 const switcher=document.querySelector<HTMLButtonElement>('#texture-toggle');
 const refreshSwitch=()=>{if(switcher){switcher.hidden=false;switcher.textContent=enabled?'Texture on':'Texture off';switcher.setAttribute('aria-pressed',String(enabled));}};
 refreshSwitch();
 const refreshers:Array<()=>void>=[];
 switcher?.addEventListener('click',()=>{enabled=!enabled;document.documentElement.dataset.texture=enabled?'on':'off';try{localStorage.setItem('drawing-texture',enabled?'on':'off');}catch{}refreshSwitch();refreshers.forEach(f=>f());});
 document.querySelectorAll<HTMLElement>('[data-technical-surface]').forEach(host=>{
  if(host.dataset.ready)return;host.dataset.ready='true';
  const canvas=host.querySelector<HTMLCanvasElement>('canvas')!;
  let gl:WebGLRenderingContext|null=null, program:WebGLProgram|null=null, buffer:WebGLBuffer|null=null, visible=false,failed=false,frame=0,last=0;
  const motion=host.dataset.motion==='true';
  let timeLocation:WebGLUniformLocation|null=null,darkLocation:WebGLUniformLocation|null=null,resolutionLocation:WebGLUniformLocation|null=null;
  function create(){
   try {
    gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power'});
    if(!gl){failed=true;return;}
    const compile=(type:number,source:string)=>{const shader=gl!.createShader(type)!;gl!.shaderSource(shader,source);gl!.compileShader(shader);if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){gl!.deleteShader(shader);throw new Error('shader');}return shader;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('link');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    timeLocation=gl.getUniformLocation(program,'time');darkLocation=gl.getUniformLocation(program,'dark');resolutionLocation=gl.getUniformLocation(program,'resolution');
   }catch{failed=true;canvas.style.display='none';}
  }
  function draw(now:number){
   if(!gl||!program||failed)return;
   const bounds=host.getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(180000/Math.max(1,bounds.width*bounds.height)));
   const w=Math.max(1,Math.round(bounds.width*ratio)),h=Math.max(1,Math.round(bounds.height*ratio));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.uniform2f(resolutionLocation,w,h);gl.uniform1f(timeLocation,motion&&!reduced.matches?now/1000:0);gl.uniform1f(darkLocation,document.documentElement.dataset.theme==='dark'?1:0);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function tick(now:number){frame=0;if(!visible||!enabled||document.hidden||reduced.matches||!motion||failed)return;if(now-last>=50){draw(now);last=now;}frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;if(!visible||!enabled||document.hidden||failed)return;if(!gl)create();draw(performance.now());if(motion&&!reduced.matches&&!failed)frame=requestAnimationFrame(tick);}
  refreshers.push(sync);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});observer.observe(host);
  const resize=new ResizeObserver(sync);resize.observe(host);
  const theme=new MutationObserver(sync);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  canvas.addEventListener('webglcontextlost',()=>{failed=true;cancelAnimationFrame(frame);canvas.style.display='none';});
  window.addEventListener('pageshow',sync);
  window.addEventListener('pagehide',(event)=>{cancelAnimationFrame(frame);if(event.persisted)return;observer.disconnect();resize.disconnect();theme.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);window.removeEventListener('pageshow',sync);if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program);} });
 });
}
