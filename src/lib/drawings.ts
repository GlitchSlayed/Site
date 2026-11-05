/** Author-made illustrative plates. These are not measured data or fabrication drawings. */
export type DrawingKind = 'airfoils' | 'bwb' | 'uki' | 'gofr' | 'rocket' | 'wing' | 'orbit' | 'code';
export const drawingInfo: Record<DrawingKind, {title:string; caption:string; label:string}> = {
  airfoils: {title:'Three sections, one comparison',caption:'Illustrative section comparison. Geometry and mounting are still to be finalized.',label:'Airfoil experiment / Section study'},
  bwb: {title:'Lift and structure share the same airframe',caption:'Conceptual planform and cabin-section sketch. No aircraft dimensions or results are implied.',label:'Blended wing body / Configuration study'},
  uki: {title:'One image, a recoverable transition',caption:'UKI assembly and trial-boot concept, based on the project description.',label:'RustyUKI / Boot architecture'},
  gofr: {title:'A small set of deliberate changes',caption:'Proposed Fedora remix layers. This is an architecture plan, not a released system.',label:'GOFR / Proposed system layers'},
  rocket: {title:'A flight vehicle, taken apart',caption:'Illustrative assembly study. Not a built vehicle, trajectory solution, or manufacturing drawing.',label:'Flight hardware / Assembly sketch'},
  wing: {title:'Planform, section, reference',caption:'Illustrative wing study. No analysis results or dimensions are implied.',label:'Aerodynamics / Geometry study'},
  orbit: {title:'A path defined by its assumptions',caption:'Illustrative orbital geometry. Not an integrated trajectory.',label:'Flight mechanics / Geometry sketch'},
  code: {title:'Inputs, transformation, checks',caption:'Illustrative software structure. Not a benchmark or live system trace.',label:'Software / Interface study'},
};
const text=(x:number,y:number,label:string,cls='label')=>`<text class="${cls}" x="${x}" y="${y}">${label}</text>`;
const path=(d:string,cls='line')=>`<path class="${cls}" d="${d}"/>`;
const rect=(x:number,y:number,w:number,h:number,cls='line')=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const arrow=(x:number,y:number)=>path(`M${x-5} ${y-4}l5 4-5 4`,'accent');
export function datum(x:number,y:number){return path(`M${x-7} ${y}h14M${x} ${y-7}v14`,'faint');}
function frame(width:number,height:number){return [path(`M24 40V24h16M${width-40} 24h16v16M24 ${height-40}v16h16M${width-40} ${height-24}h16v-16`,'faint'),...Array.from({length:9},(_,i)=>path(`M${80+i*(width-160)/8} ${height-24}v-5`,'faint'))].join('');}
/** NACA four-digit section coordinates; closed trailing edge (-0.1036 x^4).
 * Unit chord, cosine spacing, camber-normal thickness. Illustration only.
 */
export function airfoilCoordinates(m=0,p=.4,t=.12){
 const upper:Array<[number,number]>=[],lower:Array<[number,number]>=[],camber:Array<[number,number]>=[];
 for(let i=0;i<=80;i++){
  const x=(1-Math.cos(Math.PI*i/80))/2;
  const yt=5*t*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x*x*x-.1036*x*x*x*x);
  const yc=m===0?0:x<p?m/(p*p)*(2*p*x-x*x):m/((1-p)**2)*(1-2*p+2*p*x-x*x);
  const slope=m===0?0:x<p?2*m/(p*p)*(p-x):2*m/((1-p)**2)*(p-x);
  const theta=Math.atan(slope);
  upper.push([x-yt*Math.sin(theta),yc+yt*Math.cos(theta)]);
  lower.push([x+yt*Math.sin(theta),yc-yt*Math.cos(theta)]);camber.push([x,yc]);
 }
 return {upper,lower,camber};
}
function sectionPath(m:number,baseline:number,camberOnly=false){
 const data=airfoilCoordinates(m);
 const points=camberOnly?data.camber:[...data.upper,...data.lower.slice().reverse()];
 return points.map(([x,y],i)=>`${i?'L':'M'}${(150+x*505).toFixed(2)} ${(baseline-y*505).toFixed(2)}`).join(' ')+(camberOnly?'':'Z');
}
function airfoils(){return `
${text(54,65,'01 / SECTION COMPARISON','small')}
${path('M150 102V375M655 102V375','datum')}
${path(sectionPath(0,169),'body')}
${path('M150 169H670','datum')}${text(54,163,'0012','number')}${text(54,185,'SYMMETRIC','small')}
${path(sectionPath(.04,263),'body')}
${path('M150 263H670','datum')}${path(sectionPath(.04,263,true),'accent-dash')}${text(54,257,'4412','number')}${text(54,279,'CAMBERED','small')}
${rect(150,346,505,5,'body')}${text(54,341,'PLATE','number')}${text(54,363,'REFERENCE','small')}
${path('M150 394H655M150 387v14M655 387v14','line')}${text(325,418,'COMMON CHORD / c','small')}
${path('M480 249l103-48h100','faint')}${text(586,191,'CAMBER LINE','small')}
${text(54,450,'Comparing shape, alignment, and the limits of a prediction.','caption')}`;}
function bwb(){return `
${text(54,65,'02 / PLANFORM + CABIN SECTION','small')}
${path('M325 80V366M84 318H568','datum')}
${path('M325 94 C345 115 352 150 372 174 L558 291 L558 312 L414 282 Q383 291 357 280 L325 302 L293 280 Q267 291 236 282 L92 312 L92 291 L278 174 C298 150 305 115 325 94Z','body')}
${path('M325 94L345 176 355 259 325 283 295 259 305 176Z','accent-fill')}
${path('M278 174L293 280M372 174L357 280M180 248L236 282M470 248L414 282','faint')}
${path('M92 340H558M92 333v14M558 333v14','line')}${text(292,365,'SPAN / b','small')}
${path('M352 202H609V170','faint')}${text(596,126,'CABIN','small')}${text(596,146,'SECTION','small')}
${path('M587 218Q587 188 635 188H685Q733 188 733 218V236H587Z','body')}
${path('M598 217H722M620 194V235M648 190V235M676 190V235M704 194V235','faint')}
${path('M603 258v-14m-5 7 5-7 5 7M654 258v-14m-5 7 5-7 5 7M708 258v-14m-5 7 5-7 5 7','accent')}
${text(585,291,'NONCIRCULAR','small')}${text(585,310,'PRESSURE VESSEL','small')}
${text(54,412,'Less drag. More structure?','caption')}${text(54,445,'The tradeoff matters more than the silhouette.','small')}`;}
function uki(){return `
${text(54,65,'03 / IMAGE ASSEMBLY','small')}
${rect(70,114,154,48,'body')}${text(87,144,'LINUX KERNEL')}
${rect(70,184,154,48,'body')}${text(87,214,'INITRAMFS')}
${rect(70,254,154,48,'body')}${text(87,284,'COMMAND LINE')}
${path('M224 138H265V208H310M224 208H310M224 278H265V208','line')}${arrow(310,208)}
${rect(325,109,202,207,'body')}${rect(339,123,174,179,'faint')}${text(355,153,'.efi','number')}${text(355,182,'UNIFIED KERNEL','small')}${text(355,201,'IMAGE','small')}
${path('M355 226H493M355 243H466M355 260H483','faint')}
${path('M527 208H586','accent')}${arrow(586,208)}
${rect(601,178,141,60,'body')}${text(618,203,'BootNext')}${text(618,223,'ONE-TIME TRIAL','small')}
${path('M672 238V364H427V331','accent-dash')}${text(455,387,'PROMOTE AFTER SUCCESS','small')}
${rect(70,354,257,45,'faint')}${text(85,382,'EXISTING DEFAULT RETAINED','small')}
${text(54,450,'Build with dracut + ukify. Keep a way back.','caption')}`;}
function gofr(){return `
${text(54,65,'04 / PROPOSED SYSTEM STACK','small')}
${path('M180 105V382M575 105V382','datum')}
${path('M180 119L462 89 575 132 293 164Z','body')}${path('M180 119v26l113 45 282-31v-27','line')}
${path('M180 199L462 169 575 212 293 244Z','body')}${path('M180 199v26l113 45 282-31v-27','line')}
${path('M180 279L462 249 575 292 293 324Z','accent-fill')}${path('M180 279v26l113 45 282-31v-27','accent')}
${path('M180 359L462 329 575 372 293 404Z','body')}
${path('M526 119H622M526 199H622M526 279H622M526 359H622','faint')}
${text(630,116,'DESKTOP','small')}${text(630,134,'GNOME / WAYLAND','small')}
${text(630,196,'USER TOOLS','small')}${text(630,214,'BRUSH / ZOXIDE','small')}
${text(630,276,'BOOT + KERNEL','small')}${text(630,294,'UKI / SYSTEMD','small')}
${text(630,356,'FOUNDATION','small')}${text(630,374,'FEDORA / RPM','small')}
${text(54,450,'Stay close to upstream. Make each change earn its place.','caption')}`;}
function rocket(){return `
${text(45,65,'FLIGHT HARDWARE','small')}${text(45,94,'An assembly study','caption')}
${path('M318 115V616','datum')}
${path('M318 120Q286 152 284 195H352Q350 152 318 120Z','body')}
${path('M318 130V186M291 182H345','faint')}
${rect(284,223,68,107,'body')}${path('M284 229H352M284 324H352','line')}${rect(295,239,46,65,'faint')}${path('M295 250H341M303 239V304M333 239V304','faint')}
${path('M284 354H352V490H284Z','body')}${path('M284 361H352M284 483H352','line')}${path('M297 365H339V479H297Z','faint')}${path('M297 379H339M297 465H339','faint')}
${path('M284 439L247 494V530L284 504M352 439L389 494V530L352 504','body')}
${path('M299 520H337L329 545 349 575H287L307 545Z','accent-fill')}
${path('M299 520L310 545 299 565M337 520L326 545 337 565','faint')}${path('M292 570h52M296 563h8M332 563h8','faint')}
${path('M284 195V223M352 195V223M284 330V354M352 330V354M299 490V520M337 490V520','datum')}
${path('M351 169H430L453 146H581M352 269H461M352 394H461M389 482H461M348 566H461','faint')}
${text(462,139,'01 / NOSE','small')}${text(470,263,'02 / PAYLOAD','small')}${text(470,388,'03 / AIRFRAME','small')}${text(470,476,'04 / FINS','small')}${text(470,560,'05 / NOZZLE','small')}
${path('M211 120V575M204 120h14M204 575h14','line')}
${text(45,323,'EXPLODED','small')}${text(45,342,'VIEW','small')}
${path('M77 561v-54m-5 8 5-8 5 8M77 561h54m-8-5 8 5-8 5','line')}${text(70,494,'x','small')}${text(141,566,'y','small')}
${text(45,657,'Geometry → loads → materials → verification','caption')}${text(45,686,'SCHEMATIC / NOT TO SCALE','small')}`;}
function orbit(){return `${text(54,65,'REFERENCE FRAME / FLIGHT MECHANICS','small')}${path('M350 100V375M100 240H680','datum')}<ellipse class="line" cx="350" cy="240" rx="253" ry="119" transform="rotate(-14 350 240)"/><circle class="body" cx="270" cy="260" r="43"/>${path('M270 260L559 150','accent')}${path('M559 150l-45-53','line')}<circle class="accent-fill" cx="559" cy="150" r="6"/>${text(408,230,'r','number')}${text(505,91,'v','number')}${text(54,436,'Position needs a reference frame.','caption')}`;}
function code(){return `${text(54,65,'SOFTWARE / CONTRACTS + CHECKS','small')}${rect(70,145,166,165,'body')}${rect(316,145,166,165,'body')}${rect(562,145,166,165,'body')}${text(89,179,'INPUT')}${text(335,179,'TRANSFORM')}${text(581,179,'CHECK')}${path('M89 202h121m-121 18h96m-96 18h112m-112 18h83M335 202h121m-121 18h96m-96 18h112m-112 18h83M581 202h121m-121 18h96m-96 18h112m-112 18h83','faint')}${path('M236 230H301M482 230H547','accent')}${arrow(301,230)}${arrow(547,230)}${path('M645 310V371H153V325','datum')}${text(283,397,'REPRODUCE / INSPECT / REVISE','small')}${text(54,450,'Make the behavior inspectable.','caption')}`;}
export function drawingSvg(kind:DrawingKind,instance='plate', palette?: {paper:string;ink:string;accent:string;faint:string}) {
 const id='drawing-'+instance.replace(/[^a-zA-Z0-9_-]/g,'');
 const hero=kind==='rocket',width=hero?640:800,height=hero?720:480;
 const p=palette||{paper:'var(--plate-paper, #f2efe6)',ink:'var(--plate-ink, #383b36)',accent:'var(--plate-accent, #a4462b)',faint:'var(--plate-faint, #b6b4a8)'};
 const content=kind==='airfoils'?airfoils():kind==='bwb'||kind==='wing'?bwb():kind==='uki'?uki():kind==='gofr'?gofr():kind==='rocket'?rocket():kind==='orbit'?orbit():code();
 return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 ${width} ${height}" fill="none" aria-hidden="true" focusable="false"><style>
 #${id} .line,#${id} .body{stroke:${p.ink};stroke-width:1.5;stroke-linejoin:round}#${id} .body{fill:${p.paper};fill-opacity:.72}
 #${id} .faint{stroke:${p.faint};stroke-width:1}#${id} .datum{stroke:${p.faint};stroke-width:1;stroke-dasharray:9 5 2 5}
 #${id} .accent,#${id} .accent-dash,#${id} .accent-fill{stroke:${p.accent};stroke-width:1.5;stroke-linejoin:round}#${id} .accent-fill{fill:${p.accent};fill-opacity:.09}#${id} .accent-dash{stroke-dasharray:5 5}
 #${id} text{fill:${p.ink};font-family:ui-monospace,monospace;font-size:13px;letter-spacing:.4px}#${id} .small{font-size:11px;letter-spacing:1px}#${id} .number{font-family:Georgia,serif;font-size:24px}#${id} .caption{font-family:Georgia,serif;font-size:19px;letter-spacing:0}
 </style>${frame(width,height)}${content}</svg>`;
}
