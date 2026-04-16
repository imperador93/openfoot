#!/usr/bin/env node
// find-encoding-issues.cjs
// Encontra jogadores com problemas de encoding

const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../src-tauri/resources/data/players.json');

console.log('🔍 Procurando problemas de encoding...\n');

const data = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

// Padrões que indicam encoding corrompido
const badPatterns = [
  /Ã[^£§©ª³´º¡­]/,  // Ã seguido de char que não é acentuação esperada
  /�/,                // Replacement character
  /[^\x00-\x7F\u00C0-\u017F\u0100-\u024F]/,  // Chars fora do range Latin
];

const issues = [];

data.Players.forEach((player, index) => {
  let hasIssue = false;
  let problem = '';
  
  // Verificar nome
  for (const pattern of badPatterns) {
    if (pattern.test(player.Name)) {
      hasIssue = true;
      problem = 'Nome com encoding suspeito';
      break;
    }
  }
  
  // Verificar Status
  if (player.Status && player.Status.includes('Ã') && !player.Status.includes('Não')) {
    hasIssue = true;
    problem = 'Status com encoding suspeito';
  }
  
  if (hasIssue) {
    issues.push({
      index: index + 1,
      id: player.Id,
      name: player.Name,
      team: player.TeamId,
      status: player.Status,
      problem,
    });
  }
});

if (issues.length === 0) {
  console.log('✅ Nenhum problema de encoding encontrado!');
} else {
  console.log(`❌ Encontrados ${issues.length} jogadores com problemas:\n`);
  
  issues.slice(0, 20).forEach(issue => {
    console.log(`[${issue.index}] ${issue.name} (${issue.team})`);
    console.log(`     ID: ${issue.id}`);
    console.log(`     Status: ${issue.status || 'N/A'}`);
    console.log(`     Problema: ${issue.problem}`);
    console.log();
  });
  
  if (issues.length > 20) {
    console.log(`... e mais ${issues.length - 20} jogadores\n`);
  }
}

console.log(`\nTotal analisado: ${data.Players.length} jogadores`);
