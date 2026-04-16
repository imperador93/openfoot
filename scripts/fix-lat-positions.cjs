#!/usr/bin/env node
// fix-lat-positions.cjs
// Converte jogadores com "Position": "LAT" para LAT-E ou LAT-D

const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../src-tauri/resources/data/players.json');

console.log('🔧 Corrigindo posições LAT...\n');

const data = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

// Encontrar jogadores com LAT
const latPlayers = data.Players.filter(p => p.Position === 'LAT');
console.log(`Encontrados ${latPlayers.length} jogadores com posição LAT\n`);

// Converter alternando entre LAT-E e LAT-D para ter diversidade
let converted = 0;
data.Players.forEach((player, index) => {
  if (player.Position === 'LAT') {
    // Alternar: índices pares = LAT-E, ímpares = LAT-D
    const newPos = (converted % 2 === 0) ? 'LAT-E' : 'LAT-D';
    console.log(`  ${player.Name} (${player.TeamId}): LAT → ${newPos}`);
    player.Position = newPos;
    converted++;
  }
});

// Salvar arquivo corrigido
fs.writeFileSync(playersPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`\n✅ ${converted} jogadores convertidos`);
console.log(`   ${Math.ceil(converted / 2)} laterais esquerdos (LAT-E)`);
console.log(`   ${Math.floor(converted / 2)} laterais direitos (LAT-D)`);
console.log(`\n💾 Arquivo salvo: ${playersPath}`);
