// Sólo imágenes que iClap ya permite leer sin sesión. No es un proxy de URLs.
const ORIGIN='https://iclap-catalogo.vercel.app';
const KEY=/^catalog\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|avif)$/;
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
  const params=new URL(req.url,'https://local.invalid').searchParams,key=params.get('key');
  if(params.getAll('empresa').length!==1||params.get('empresa')!=='1122')return res.status(403).end();
  if(params.getAll('key').length!==1||!KEY.test(key||''))return res.status(400).end();
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  try{
    const upstream=await fetch(ORIGIN+'/api/media?key='+encodeURIComponent(key),{method:'GET',redirect:'error',signal:ctrl.signal,credentials:'omit'});
    if(upstream.status===404)return res.status(404).end();
    const type=String(upstream.headers.get('content-type')||'').split(';')[0];
    if(!upstream.ok||!['image/jpeg','image/png','image/webp','image/avif'].includes(type)||Number(upstream.headers.get('content-length'))>2097152)throw new Error('Imagen pública no válida');
    const bytes=Buffer.from(await upstream.arrayBuffer());if(bytes.length>2097152)throw new Error('Imagen demasiado grande');
    res.setHeader('Content-Type',type);res.setHeader('Cache-Control','public, max-age=300, s-maxage=300');
    return res.status(200).end(bytes);
  }catch(e){console.error('[iClap imagen]',e.name==='AbortError'?'timeout':'lectura pública fallida');return res.status(503).end();}
  finally{clearTimeout(timer);}
};
