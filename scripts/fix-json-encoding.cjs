#!/usr/bin/env node
// fix-json-encoding.cjs
// Corrige encoding UTF-8 corrompido no players.json

const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../src-tauri/resources/data/players.json');

console.log('🔧 Corrigindo encoding do players.json...\n');

// Ler como buffer para preservar os bytes originais
const buffer = fs.readFileSync(playersPath);

// Converter de Latin-1 (Windows-1252) para UTF-8
// Os bytes estavam sendo interpretados errado
let content = buffer.toString('latin1');

// Principais correções de caracteres:
const fixes = {
  'Ã£': 'ã',  // ão, são, não etc
  'Ã§': 'ç',  // ç
  'Ã©': 'é',  // é
  'Ãª': 'ê',  // ê
  'Ã³': 'ó',  // ó
  'Ã´': 'ô',  // ô
  'Ãº': 'ú',  // ú
  'Ã¡': 'á',  // á
  'Ã­': 'í',  // í
  'Ã': 'Á',   // Á maiúsculo
  'Ã‰': 'É',  // É maiúsculo
  'Ã"': 'Ó',  // Ó maiúsculo
  'Ãœ': 'Ü',  // Ü
  'Ã¼': 'ü',  // ü
  'Ã±': 'ñ',  // ñ
};

let fixCount = 0;
for (const [wrong, right] of Object.entries(fixes)) {
  const before = content.length;
  content = content.split(wrong).join(right);
  const after = content.length;
  const replaced = (before - after) / (wrong.length - right.length);
  if (replaced > 0) {
    fixCount += replaced;
    console.log(`  "${wrong}" → "${right}": ${replaced} ocorrências`);
  }
}

// Validar JSON
try {
  const data = JSON.parse(content);
  console.log(`\n✅ JSON válido após correção`);
  console.log(`   Total de jogadores: ${data.Players.length}`);
  console.log(`   Total de correções: ${fixCount}`);
  
  // Verificar alguns nomes para confirmar
  const examples = data.Players
    .filter(p => p.Name.includes('ã') || p.Name.includes('ç') || p.Name.includes('é'))
    .slice(0, 5);
  
  if (examples.length > 0) {
    console.log('\n📝 Exemplos de nomes corrigidos:');
    examples.forEach(p => console.log(`   - ${p.Name} (${p.Position})`));
  }

  // Salvar com UTF-8 correto
  fs.writeFileSync(playersPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n💾 Arquivo salvo com encoding UTF-8 correto`);
  console.log(`   ${playersPath}`);

} catch (err) {
  console.error('\n❌ Erro ao validar JSON:', err.message);
  process.exit(1);
}
