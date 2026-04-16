#!/usr/bin/env node
// fix-double-encoding.cjs
// Corrige double-encoding em nomes de jogadores

const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../src-tauri/resources/data/players.json');

console.log('🔧 Corrigindo double-encoding...\n');

// Ler como texto para ver os bytes reais
let content = fs.readFileSync(playersPath, 'utf8');

// Padrões de double-encoding para corrigir
const fixes = [
  [/Ã‚Ã(\w)/g, (match, next) => {
    // Map próximo char para o acento correto
    const map = {
      '©': 'É', 'ª': 'Ê', '­': 'Í', '³': 'Ó', '¡': 'Á', 
      'º': 'ú', '§': 'ç', 'µ': 'õ', '£': 'ã', '¢': 'â'
    };
    return map[next] || match;
  }],
  ['Ã‚Â', ''], // Remove marcadores UTF-8 extras
  ['ÃÂÃÂ', 'Á'],
  ['ÃÂÃÂctavio', 'Octavio'],
  ['ÃÂÃÂlvaro', 'Álvaro'], 
  ['ÃÂÃÂngel', 'Ángel'],
  ['CÃÂÃÂ¢ndido', 'Cândido'],
];

let fixCount = 0;
const before = content.length;

for (const fix of fixes) {
  if (typeof fix[0] === 'string') {
    const Count = (content.match(new RegExp(fix[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    content = content.split(fix[0]).join(fix[1]);
    fixCount += Count;
    if (Count > 0) console.log(`  "${fix[0]}" → "${fix[1]}": ${Count}x`);
  } else {
    // É uma regex com função callback
    content = content.replace(fix[0], fix[1]);
  }
}

// Salvar corrigido
fs.writeFileSync(playersPath, content, 'utf8');

console.log(`\n✅ ${fixCount} substituições feitas`);
console.log(`💾 Arquivo salvo: ${playersPath}`);
