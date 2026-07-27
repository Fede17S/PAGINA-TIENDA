/* =============================================================================
   /api/og.js   ·   v2026.07.27-og
   -----------------------------------------------------------------------------
   QUÉ HACE
   Cuando alguien pega el link de la tienda en WhatsApp (o Facebook, Instagram,
   Telegram, etc.), esa app manda un robot a leer la página para armar el
   "cuadradito" de vista previa. Ese robot NO ejecuta JavaScript, así que de la
   tienda real (que es 100% JavaScript) no ve absolutamente nada.

   Este archivo es la solución: Vercel manda SOLO a esos robots acá, este código
   busca en Supabase el nombre y el logo de la empresa según el ?emp=CODIGO del
   link, y devuelve una página chiquita con las etiquetas correctas.
   Resultado: cada empresa tiene su propio preview, con su nombre y su logo.

   IMPORTANTE: los clientes de verdad NUNCA pasan por acá. Siguen entrando
   directo al index.html como siempre. Si este archivo fallara, el peor caso es
   que el preview salga genérico — la tienda no se ve afectada.

   DÓNDE VA
   En una carpeta llamada  api  al lado del index.html, junto con vercel.json:
       /index.html
       /og.png
       /vercel.json
       /api/og.js      <-- este archivo
   ============================================================================= */

// --- Configuración -----------------------------------------------------------
const SB_URL = "https://vhoswhyixqtomgqudigj.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZob3N3aHlpeHF0b21ncXVkaWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTI4ODIsImV4cCI6MjA5NTM4ODg4Mn0.gjUaVJ1RvF3KrjfXVyh8wYIso4QW6RtIfFRbkd0PyA8";

// Dominio de respaldo. Normalmente NO se usa: el dominio real se detecta solo
// (ver sitioDe más abajo), así que esto sigue andando si mañana le ponés un
// dominio propio a la tienda.
const SITIO_FALLBACK = "https://pagina-tienda-seven.vercel.app";

/* Detecta el dominio por el que entró el pedido. Así el preview siempre apunta
   al mismo dominio que abrió el cliente, sin tener que tocar este archivo. */
function sitioDe(req) {
  try {
    const h = req && req.headers ? (req.headers["x-forwarded-host"] || req.headers.host) : "";
    const host = String(h || "").split(",")[0].trim();
    if (host && /^[a-zA-Z0-9.\-]+(:[0-9]+)?$/.test(host)) {
      const proto = /^localhost(:|$)|^127\./.test(host) ? "http://" : "https://";
      return proto + host;
    }
  } catch (e) {}
  return SITIO_FALLBACK;
}

// Textos genéricos (cuando el link viene sin ?emp= o la empresa no existe).
const TITULO_DEFAULT = "Tienda online · Catálogo y pedidos";
const DESC_DEFAULT = "Mirá el catálogo con precios actualizados, armá tu pedido y recibilo en tu casa o en tu negocio.";

// Cuánto esperamos a Supabase antes de rendirnos y mostrar el preview genérico.
const TIMEOUT_MS = 2500;
// -----------------------------------------------------------------------------

/* Escapa el texto para que no rompa el HTML ni permita inyectar etiquetas. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Recorta un texto largo para que entre en el preview sin quedar cortado feo. */
function recortar(s, max) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

/* Sólo aceptamos imágenes con URL absoluta https (WhatsApp no toma otra cosa). */
function imagenValida(url) {
  const u = String(url == null ? "" : url).trim();
  if (!/^https:\/\//i.test(u)) return "";
  if (u.length > 900) return "";
  return u;
}

/* GET a Supabase con timeout. Nunca lanza error: si algo falla devuelve null. */
async function sbGet(recurso) {
  const ctrl = new AbortController();
  const reloj = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    const r = await fetch(SB_URL + "/rest/v1/" + recurso, {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/* Busca la empresa por su código (el ?emp= del link). */
async function buscarEmpresa(codigo) {
  const filas = await sbGet(
    "empresas?select=id,codigo,nombre,logo,color&codigo=eq." + encodeURIComponent(codigo) + "&limit=1"
  );
  return filas && filas[0] ? filas[0] : null;
}

/* Busca la configuración visual que el admin editó desde la propia tienda. */
async function buscarConfig(empresaId) {
  const filas = await sbGet(
    "tienda_config?select=config&empresa_id=eq." + encodeURIComponent(empresaId) + "&limit=1"
  );
  return filas && filas[0] && filas[0].config ? filas[0].config : null;
}

/* Arma la páginita que ve el robot. */
function armarHtml(datos) {
  const titulo = esc(datos.titulo);
  const desc = esc(datos.desc);
  const img = esc(datos.img);
  const url = esc(datos.url);
  const destino = esc(datos.destino);            // para atributos HTML (usa &amp;)
  // Para el JavaScript necesitamos la URL SIN escapar en HTML: si le dejáramos
  // el &amp; el navegador iría a un parámetro llamado "amp;og" y el redirect
  // volvería a caer acá en un bucle infinito.
  const destinoJs = JSON.stringify(String(datos.destino)).replace(/</g, "\\u003c");
  const color = esc(datos.color || "#0a1628");
  // Sólo declaramos medidas si es nuestra imagen de respaldo (sabemos que es 1200x630).
  const medidas = datos.imgEsDefault
    ? '  <meta property="og:image:type" content="image/png" />\n' +
      '  <meta property="og:image:width" content="1200" />\n' +
      '  <meta property="og:image:height" content="630" />\n'
    : "";

  return '<!DOCTYPE html>\n' +
    '<html lang="es">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8" />\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '  <title>' + titulo + '</title>\n' +
    '  <meta name="description" content="' + desc + '" />\n' +
    '  <meta name="theme-color" content="' + color + '" />\n' +
    '  <link rel="canonical" href="' + url + '" />\n' +
    '\n' +
    '  <meta property="og:type" content="website" />\n' +
    '  <meta property="og:site_name" content="' + titulo + '" />\n' +
    '  <meta property="og:title" content="' + titulo + '" />\n' +
    '  <meta property="og:description" content="' + desc + '" />\n' +
    '  <meta property="og:url" content="' + url + '" />\n' +
    '  <meta property="og:locale" content="es_AR" />\n' +
    '  <meta property="og:image" content="' + img + '" />\n' +
    '  <meta property="og:image:secure_url" content="' + img + '" />\n' +
    medidas +
    '  <meta property="og:image:alt" content="' + titulo + '" />\n' +
    '\n' +
    '  <meta name="twitter:card" content="' + (datos.imgEsDefault ? "summary_large_image" : "summary") + '" />\n' +
    '  <meta name="twitter:title" content="' + titulo + '" />\n' +
    '  <meta name="twitter:description" content="' + desc + '" />\n' +
    '  <meta name="twitter:image" content="' + img + '" />\n' +
    '\n' +
    '  <!-- Si entra una persona de verdad (no un robot), la mandamos a la tienda. -->\n' +
    '  <meta http-equiv="refresh" content="0; url=' + destino + '" />\n' +
    '  <script>try{window.location.replace(' + destinoJs + ');}catch(e){}</script>\n' +
    '</head>\n' +
    '<body style="margin:0;background:' + color + ';color:#fff;font-family:system-ui,sans-serif">\n' +
    '  <p style="padding:24px">Abriendo <a style="color:#c9933a" href="' + destino + '">' + titulo + '</a>…</p>\n' +
    '</body>\n' +
    '</html>';
}

// --- Punto de entrada --------------------------------------------------------
module.exports = async function handler(req, res) {
  const SITIO = sitioDe(req);
  // Imagen de respaldo, para cuando la empresa no tiene logo cargado.
  const IMG_DEFAULT = SITIO + "/og.png";

  // 1) Sacamos el ?emp=CODIGO del link (con dos métodos, por las dudas).
  let codigo = "";
  try {
    if (req.query && req.query.emp) codigo = String(req.query.emp);
    if (!codigo) {
      const u = new URL(req.url, SITIO);
      codigo = u.searchParams.get("emp") || "";
    }
  } catch (e) {
    codigo = "";
  }
  codigo = codigo.trim().slice(0, 64);

  // 2) Valores por defecto: si nada funciona, esto es lo que se muestra.
  let titulo = TITULO_DEFAULT;
  let desc = DESC_DEFAULT;
  let img = IMG_DEFAULT;
  let color = "#0a1628";

  // 3) Si vino código de empresa, buscamos sus datos reales.
  if (codigo) {
    try {
      const empresa = await buscarEmpresa(codigo);
      if (empresa) {
        const cfg = (await buscarConfig(empresa.id)) || {};
        const nombre = recortar(cfg.nombre || empresa.nombre || "", 70);
        if (nombre) titulo = nombre;

        const frase = recortar(cfg.tagline || "", 90);
        const partes = [];
        if (frase) partes.push(frase);
        partes.push("Mirá el catálogo, armá tu pedido y recibilo en tu casa o en tu negocio.");
        desc = recortar(partes.join(" · "), 190);

        const logo = imagenValida(empresa.logo);
        if (logo) img = logo;

        const c = String(cfg.colorMarca || empresa.color || "").trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) color = c;
      }
    } catch (e) {
      // Si algo falla, seguimos con los valores genéricos. Nunca rompemos.
    }
  }

  const urlPublica = SITIO + "/" + (codigo ? "?emp=" + encodeURIComponent(codigo) : "");
  // A las personas las mandamos a la tienda con &og=1: ese parámetro le avisa a
  // Vercel que NO las vuelva a traer acá (ver la regla "missing" en vercel.json).
  const destino = SITIO + "/?" + (codigo ? "emp=" + encodeURIComponent(codigo) + "&" : "") + "og=1";

  const html = armarHtml({
    titulo: titulo,
    desc: desc,
    img: img,
    color: color,
    url: urlPublica,
    destino: destino,
    imgEsDefault: img === IMG_DEFAULT,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache: los robots repiten mucho la misma consulta. Esto le ahorra viajes a Supabase.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.statusCode = 200;
  res.end(html);
};
