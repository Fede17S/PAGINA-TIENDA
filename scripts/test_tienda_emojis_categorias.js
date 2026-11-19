const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(fs.existsSync('pagina tienda.html') ? 'pagina tienda.html' : 'index.html', 'utf8');
const ctx = vm.createContext({CFG_DEFAULT: {ordenCategorias: [], categoriasOcultas: [], emojisCategorias: {}}});
vm.runInContext(html.slice(html.indexOf('function normalizarEmojiCategoria'), html.indexOf('const fmt = n =>')), ctx);
vm.runInContext('globalThis.icono = emojiCat;', ctx);
for (const emoji of ['🧴','🍫','🛠️','❤️‍🔥','👩🏽‍🌾','👨‍👩‍👧‍👦','🇦🇷','1️⃣']) {
  assert.equal(ctx.normalizarEmojiCategoria(' ' + emoji + ' '), emoji);
}
assert.equal(ctx.normalizarEmojiCategoria('🍪🍫'), '🍪');
for (const valor of ['', null, 42, {}, 'texto', '<img src=x>', '1', 'x'.repeat(200)]) {
  assert.equal(ctx.normalizarEmojiCategoria(valor), '');
}
for (const valor of [null, [], '🍫', 42]) {
  assert.equal(JSON.stringify(ctx.normalizarEmojisCategorias(valor)), '{}');
}
const anterior = {nombre:'Mi tienda', ordenCategorias:['Pegamentos','Farmacia'], categoriasOcultas:['Farmacia'],
  listaPublica:'pvp', emojisCategorias:{Pegamentos:'🧲'}};
const copia = JSON.stringify(anterior);
const editada = ctx.cambiarEmojiCategoria(anterior,'Farmacia','💊');
assert.equal(JSON.stringify(anterior), copia, 'No modificar la configuración guardada al editar');
assert.equal(editada.ordenCategorias, anterior.ordenCategorias);
assert.equal(editada.categoriasOcultas, anterior.categoriasOcultas);
assert.equal(editada.listaPublica,'pvp');
assert.equal(ctx.icono('Farmacia',editada.emojisCategorias),'💊');
assert.equal(ctx.icono('Pegamentos',editada.emojisCategorias),'🧲');
assert.equal(ctx.icono('Farmacia',anterior.emojisCategorias),'📦', 'Sin mezcla entre empresas o borradores');
const recargada = ctx.mergeCfg(JSON.parse(JSON.stringify(editada)));
assert.equal(ctx.icono('Farmacia',recargada.emojisCategorias),'💊');
assert.equal(ctx.icono('Farmacia',ctx.cambiarEmojiCategoria(recargada,'Farmacia','').emojisCategorias),'📦');
assert.equal(ctx.icono('Perfumería',ctx.mergeCfg({}).emojisCategorias),'🧴');
assert.equal(ctx.icono('constructor',{}),'📦');
assert.equal(ctx.icono('__proto__',ctx.cambiarEmojiCategoria({},'__proto__','✨').emojisCategorias),'✨');
const defaults = ctx.mergeCfg(null); defaults.emojisCategorias.Pegamentos='🧲';
assert.equal(ctx.mergeCfg(null).emojisCategorias.Pegamentos,undefined);
assert.equal(ctx.icono('Farmacia',ctx.mergeCfg({emojisCategorias:{Farmacia:'<script>'}}).emojisCategorias),'📦');
assert.ok(html.includes('c === "todos" ? "🏬" : emojiDeCategoria(c)'));
assert.ok(html.includes('label: emojiDeCategoria(c) + " " + c'));
console.log('Emojis de categorías: Unicode, automático, compatibilidad, persistencia y aislamiento OK');
