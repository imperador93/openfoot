#!/usr/bin/env node
// fix-specific-players.cjs
// Corrige jogadores específicos com problemas de encoding

const fs = require('fs');
const path = require('path');

const playersPath = path.join(__dirname, '../src-tauri/resources/data/players.json');

console.log('🔧 Corrigindo jogadores específicos...\n');

const data = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

// Mapa de correções por ID
const corrections = {
  'p-000020': 'Octavio',
  'p-000891': 'Álvaro Cruz',
  'p-000939': 'Álvaro Martínez',
  'p-000968': 'Álvaro Torres',
  'p-001044': 'Álvaro Sánchez',
  'p-001047': 'Álvaro Ramírez',
  'p-001073': 'Álvaro Rubio',
  'p-001085': 'Álvaro Jiménez',
  'p-001151': 'Álvaro Ramos',
  'p-001197': 'Álvaro Castillo',
  'p-001209': 'Álvaro Fernández',
  'p-001386': 'Álvaro López',
  'p-001466': 'Álvaro Molina',
  'p-001488': 'Álvaro Alonso',
  'p-001524': 'Álvaro García',
  'p-001623': 'Álvaro Rodríguez',
  'p-001640': 'Álvaro Díaz',
  'p-001855': 'Luan Cândido',
  'p-001927': 'Ángel Romero',
  'p-001973': 'Wilker Ángel',
  // Batch 2
  'p-001974': 'Matías Viña',
  'p-001982': 'Éder',
  'p-002011': 'Óscar Romero',
  'p-002042': 'Álvaro Barreal',
  'p-002151': 'Oscar Estupiñán',
};

let fixed = 0;

data.Players.forEach(player => {
  if (corrections[player.Id]) {
    const oldName = player.Name;
    player.Name = corrections[player.Id];
    console.log(`  [${player.Id}] ${oldName} → ${player.Name}`);
    fixed++;
  }
});

// Salvar arquivo corrigido
fs.writeFileSync(playersPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`\n✅ ${fixed} jogadores corrigidos`);
console.log(`💾 Arquivo salvo: ${playersPath}`);
