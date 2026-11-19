// Puente de SOLO LECTURA al catálogo público; sin credenciales ni escrituras.
const {normalizar,origen}=require('../iclap-catalogo-v1.js');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*'); // Datos que ya son públicos en iClap; incluye file:// y Capacitor.
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Sólo lectura'});}
  const params=new URL(req.url,'https://local.invalid').searchParams;
  if(params.getAll('empresa').length!==1||params.get('empresa')!=='1122')return res.status(403).json({error:'Integración no habilitada'});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const upstream=await fetch(origen+'/api/catalog',{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    if(!upstream.ok)throw new Error('upstream_http_'+upstream.status);
    if(!String(upstream.headers.get('content-type')).includes('application/json'))throw new Error('upstream_tipo');
    const body=await upstream.text();if(body.length>2000000)throw new Error('upstream_tamano');
    const products=normalizar(JSON.parse(body));
    return res.status(200).json({empresa:'1122',source:origen,updatedAt:new Date().toISOString(),products});
  }catch(error){
    console.error('[iClap] Falló lectura pública:',error.name==='AbortError'?'timeout':String(error.message).slice(0,120));
    return res.status(503).json({error:'No se pudo actualizar el catálogo de iClap. Reintentá en unos minutos.'});
  }finally{clearTimeout(timeout);}
};
