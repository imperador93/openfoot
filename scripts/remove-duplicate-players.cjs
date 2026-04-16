/**
 * Script para remover jogadores duplicados do players.json
 * 
 * Critérios para escolher qual versão manter:
 * 1. Preferência para jogadores com Age e Nationality
 * 2. Maior média de atributos (melhor overall)
 * 3. Em caso de empate, mantém o primeiro encontrado
 * 
 * Uso: node scripts/remove-duplicate-players.cjs
 */

const fs = require('fs');
const path = require('path');

const PLAYERS_JSON_PATH = path.join(__dirname, '../src-tauri/resources/data/players.json');

function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function calculateOverall(player) {
  return (
    player.Speed +
    player.Shooting +
    player.Passing +
    player.Dribbling +
    player.Defense +
    player.Stamina
  ) / 6;
}

function comparePlayer(p1, p2) {
  // 1. Preferir jogador com dados completos (Age + Nationality)
  const p1HasData = (p1.Age !== undefined && p1.Nationality !== undefined);
  const p2HasData = (p2.Age !== undefined && p2.Nationality !== undefined);
  
  if (p1HasData && !p2HasData) return 1; // p1 é melhor
  if (!p1HasData && p2HasData) return -1; // p2 é melhor
  
  // 2. Se ambos têm ou ambos não têm dados, comparar pela média de atributos
  const p1Overall = calculateOverall(p1);
  const p2Overall = calculateOverall(p2);
  
  if (p1Overall > p2Overall) return 1; // p1 é melhor
  if (p1Overall < p2Overall) return -1; // p2 é melhor
  
  // 3. Empate - mantém o primeiro
  return 0;
}

function main() {
  console.log('📂 Carregando players.json...');
  const playersData = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, 'utf-8'));
  
  console.log(`✅ Total de jogadores: ${playersData.Players.length}`);
  
  // Agrupar jogadores por nome
  const playersByName = new Map();
  
  playersData.Players.forEach((player, index) => {
    const normalizedName = normalizeString(player.Name);
    
    if (!playersByName.has(normalizedName)) {
      playersByName.set(normalizedName, []);
    }
    
    playersByName.get(normalizedName).push({
      player,
      originalIndex: index
    });
  });
  
  console.log(`📊 Jogadores únicos por nome: ${playersByName.size}`);
  
  // Encontrar duplicados
  const duplicates = Array.from(playersByName.entries())
    .filter(([name, players]) => players.length > 1);
  
  console.log(`🔍 Jogadores duplicados: ${duplicates.length}`);
  
  if (duplicates.length === 0) {
    console.log('✅ Nenhum duplicado encontrado!');
    return;
  }
  
  // Mostrar alguns exemplos
  console.log('\n🔍 Exemplos de duplicados encontrados:');
  duplicates.slice(0, 10).forEach(([name, players]) => {
    const teams = players.map(p => p.player.TeamId).join(', ');
    console.log(`  ${players[0].player.Name}: ${teams} (${players.length} versões)`);
  });
  
  // Selecionar a melhor versão de cada jogador duplicado
  const toRemove = new Set(); // índices para remover
  let totalRemoved = 0;
  
  duplicates.forEach(([name, playerEntries]) => {
    // Ordenar do melhor para o pior
    const sorted = playerEntries.sort((a, b) => comparePlayer(b.player, a.player));
    
    // Manter o melhor (índice 0), remover os outros
    for (let i = 1; i < sorted.length; i++) {
      toRemove.add(sorted[i].originalIndex);
      totalRemoved++;
    }
    
    const best = sorted[0].player;
    const removed = sorted.slice(1).map(p => p.player.TeamId);
    
    if (playerEntries.length > 1) {
      console.log(`  ✓ ${best.Name}: mantido em ${best.TeamId}, removido de ${removed.join(', ')}`);
    }
  });
  
  // Criar novo array sem os duplicados
  const uniquePlayers = playersData.Players.filter((player, index) => !toRemove.has(index));
  
  console.log('\n📊 Resumo:');
  console.log(`  Total original: ${playersData.Players.length}`);
  console.log(`  Duplicados removidos: ${totalRemoved}`);
  console.log(`  Total final: ${uniquePlayers.length}`);
  
  // Salvar arquivo
  console.log('\n💾 Salvando players.json...');
  playersData.Players = uniquePlayers;
  fs.writeFileSync(PLAYERS_JSON_PATH, JSON.stringify(playersData, null, 2), 'utf-8');
  console.log('✅ Arquivo atualizado com sucesso!');
  console.log(`\n🎉 ${totalRemoved} duplicados removidos!`);
}

main();
