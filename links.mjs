const hosts=new Set(['b23.tv','www.b23.tv','bilibili.com','www.bilibili.com','m.bilibili.com']);
const bv=/^BV[0-9A-Za-z]{10}$/;
const canonical=bvid=>({bvid,url:'https://www.bilibili.com/video/'+bvid});
function checked(raw){let url;try{url=new URL(raw);}catch{throw Error('BILI_LINK_INVALID');}if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.has(url.hostname))throw Error('BILI_LINK_HOST_NOT_ALLOWED');return url;}
export async function resolveVideo(input,{fetchImpl=fetch,signal}={}){
 const raw=String(input??'').trim();if(raw.length>2048)throw Error('BILI_LINK_INVALID');
 if(bv.test(raw))return canonical(raw);
 let url=checked(raw);
 for(let i=0;i<5;i++){
  const found=/(?:^|\/)video\/(BV[0-9A-Za-z]{10})(?:\/|$)/.exec(url.pathname);
  if(found)return canonical(found[1]);
  const response=await fetchImpl(url.href,{method:'GET',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(6000)]):AbortSignal.timeout(6000),headers:{'User-Agent':'Mozilla/5.0'}});
  await response.body?.cancel();
  if(response.status<300||response.status>=400||!response.headers.get('location'))throw Error('BILI_LINK_VIDEO_NOT_FOUND');
  url=checked(new URL(response.headers.get('location'),url).href);
 }
 throw Error('BILI_LINK_TOO_MANY_REDIRECTS');
}
