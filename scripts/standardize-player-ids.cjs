/**
 * Script para padronizar IDs de jogadores no formato p-NNNNNN
 * 
 * - Mantém IDs que já estão no formato correto (p-NNNNNN)
 * - Renumera IDs com formatos diferentes sequencialmente
 * - Não quebra nada pois IDs são apenas strings internas
 * 
 * Uso: node scripts/standardize-player-ids.cjs
 */

const fs = require('fs');
const path = require('path');

const PLAYERS_JSON_PATH = path.join(__dirname, '../src-tauri/resources/data/players.json');

function isStandardFormat(id) {
  // p-NNNNNN onde N é dígito
  return /^p-\d{6}$/.test(id);
}

function extractNumber(id) {
  const match = id.match(/^p-(\d+)$/);
  return match ? parseInt(match[1]) : -1;
}

function main() {
  console.log('📂 Carregando players.json...');
  const playersData = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, 'utf-8'));
  
  console.log(`✅ Total de jogadores: ${playersData.Players.length}`);
  
  // Separar jogadores com IDs padrão e não-padrão
  const standardPlayers = [];
  const nonStandardPlayers = [];
  
  playersData.Players.forEach(player => {
    if (isStandardFormat(player.Id)) {
      standardPlayers.push(player);
    } else {
      nonStandardPlayers.push(player);
    }
  });
  
  console.log(`\n📊 Análise de IDs:`);
  console.log(`  ✅ IDs no formato padrão (p-NNNNNN): ${standardPlayers.length}`);
  console.log(`  ⚠️  IDs não-padrão: ${nonStandardPlayers.length}`);
  
  if (nonStandardPlayers.length === 0) {
    console.log('\n✅ Todos os IDs já estão padronizados!');
    return;
  }
  
  // Encontrar o maior número usado
  let maxNumber = 0;
  standardPlayers.forEach(player => {
    const num = extractNumber(player.Id);
    if (num > maxNumber) {
      maxNumber = num;
    }
  });
  
  console.log(`\n🔢 Maior ID numérico atual: p-${String(maxNumber).padStart(6, '0')}`);
  
  // Renumerar jogadores não-padrão
  let nextNumber = maxNumber + 1;
  let renamed = 0;
  
  console.log(`\n🔄 Renumerando IDs não-padrão...`);
  
  nonStandardPlayers.forEach(player => {
    const oldId = player.Id;
    const newId = `p-${String(nextNumber).padStart(6, '0')}`;
    
    player.Id = newId;
    nextNumber++;
    renamed++;
    
    if (renamed % 50 === 0) {
      console.log(`  ⏳ Renomeados: ${renamed}...`);
    }
  });
  
  console.log(`\n📊 Resumo:`);
  console.log(`  ✅ IDs renomeados: ${renamed}`);
  console.log(`  📈 Faixa de novos IDs: p-${String(maxNumber + 1).padStart(6, '0')} a p-${String(nextNumber - 1).padStart(6, '0')}`);
  console.log(`  ✓  Total final: ${playersData.Players.length} jogadores`);
  console.log(`  ✓  Todos com IDs padronizados: p-NNNNNN`);
  
  // Verificar se há IDs duplicados (não deveria ter, mas é bom checar)
  const allIds = new Set();
  const duplicates = [];
  
  playersData.Players.forEach(player => {
    if (allIds.has(player.Id)) {
      duplicates.push(player.Id);
    }
    allIds.add(player.Id);
  });
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${duplicates.length} IDs duplicados encontrados!`);
    console.log('   Exemplos:', duplicates.slice(0, 5).join(', '));
    console.log('   Executando correção...');
    
    // Corrigir duplicados
    const usedIds = new Set();
    playersData.Players.forEach(player => {
      if (usedIds.has(player.Id)) {
        const newId = `p-${String(nextNumber).padStart(6, '0')}`;
        console.log(`   Corrigindo duplicado: ${player.Id} → ${newId}`);
        player.Id = newId;
        nextNumber++;
      }
      usedIds.add(player.Id);
    });
  }
  
  // Salvar arquivo
  console.log('\n💾 Salvando players.json...');
  fs.writeFileSync(PLAYERS_JSON_PATH, JSON.stringify(playersData, null, 2), 'utf-8');
  console.log('✅ Arquivo atualizado com sucesso!');
  console.log(`\n🎉 ${renamed} IDs padronizados no formato p-NNNNNN!`);
}

main();
