#!/usr/bin/env node
// fix-all-json-encoding.cjs
// Corrige encoding UTF-8 corrompido em todos os arquivos JSON

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../src-tauri/resources/data');
const files = ['players.json', 'teams.json', 'leagues.json'];

// Mapa de correções de caracteres UTF-8 corrompidos
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

console.log('🔧 Corrigindo encoding UTF-8 em todos os arquivos JSON...\n');

files.forEach(fileName => {
  const filePath = path.join(dataDir, fileName);
  
  console.log(`📄 ${fileName}:`);
  
  try {
    // Ler como buffer
    const buffer = fs.readFileSync(filePath);
    let content = buffer.toString('latin1');
    
    let fileFixCount = 0;
    for (const [wrong, right] of Object.entries(fixes)) {
      const before = content.length;
      content = content.split(wrong).join(right);
      const after = content.length;
      const replaced = (before - after) / (wrong.length - right.length);
      if (replaced > 0) {
        fileFixCount += replaced;
        console.log(`   "${wrong}" → "${right}": ${replaced}x`);
      }
    }
    
    if (fileFixCount === 0) {
      console.log('   ✅ Nenhuma correção necessária');
    } else {
      // Validar JSON
      const data = JSON.parse(content);
      
      // Salvar com UTF-8 correto
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`   ✅ ${fileFixCount} correções aplicadas`);
    }
    
  } catch (err) {
    console.error(`   ❌ Erro: ${err.message}`);
  }
  
  console.log();
});

console.log('✨ Processo concluído!');
