import rss from '@astrojs/rss';
import {getCollection} from 'astro:content';
import {site,url} from '../config';
export async function GET(context:any){
 const posts=(await getCollection('writing',({data})=>!data.draft)).sort((a,b)=>+b.data.date-+a.data.date);
 return rss({title:site.title,description:site.description,site:context.site||'https://example.com',items:posts.map(p=>({title:p.data.title,description:p.data.description,pubDate:p.data.date,link:url(`writing/${p.id}/`)}))});
}
