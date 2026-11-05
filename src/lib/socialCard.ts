import { drawingSvg, type DrawingKind } from './drawings';
export type SocialCard={title:string;section?:string;home?:boolean;drawing?:DrawingKind};
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function wrap(s:string,limit:number){const words=s.trim().split(/\s+/).flatMap(w=>w.length>limit?w.match(new RegExp(`.{1,${limit}}`,'g'))||[]:[w]);const lines:string[]=[];let line='';for(const word of words){if(line&&line.length+word.length+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
export function socialCardSvg({title,section='NOTEBOOK',home=false,drawing}:SocialCard){
 const headline=home?'Engineering, with the working left in.':title;
 let font=home?64:56,lines=wrap(headline,Math.floor(640/(font*.56)));
 while(lines.length>5&&font>28){font-=2;lines=wrap(headline,Math.floor(640/(font*.56)));}
 const art=drawingSvg(drawing||(home?'rocket':'wing'),'social',{paper:'#f1eee4',ink:'#4a5145',accent:'#a4462b',faint:'#b8b6a8'}).replace('<svg xmlns=',`<svg x="765" y="150" width="385" height="365" xmlns=`);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f6f3eb"/>
 <path d="M54 101H1146M54 552H1146M727 148V513" stroke="#b8b6a8"/>
 <path d="M57 35l15 28 15-28M61 52h22" stroke="#3b4137" stroke-width="2" fill="none"/><circle cx="72" cy="52" r="2" fill="#a4462b"/>
 <text x="108" y="56" font-family="Georgia,serif" font-size="25" fill="#343b32">Vansh Datta</text>
 <text x="1146" y="54" text-anchor="end" font-family="monospace" font-size="15" fill="#62675c">A PERSONAL ENGINEERING NOTEBOOK</text>
 <text x="54" y="150" font-family="monospace" font-size="14" letter-spacing="2" fill="#a4462b">${xml(section)}</text>
 ${lines.map((line,i)=>`<text x="54" y="${225+i*font*1.16}" font-family="Georgia,serif" font-size="${font}" fill="#2d352d">${xml(line)}</text>`).join('')}
 ${art}<text x="54" y="591" font-family="monospace" font-size="14" fill="#62675c">AEROSPACE / MANUFACTURING / OPEN SOFTWARE</text><text x="1146" y="591" text-anchor="end" font-family="monospace" font-size="14" fill="#62675c">glitchslayed.github.io/Site</text></svg>`;
}
