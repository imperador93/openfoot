/**
 * Script para ATUALIZAR jogadores existentes com idade e nacionalidade do CSV
 * 
 * Uso: node scripts/update-players-age-nationality.cjs <caminho-do-csv>
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

function normalizePlayerKey(name, team) {
  return `${normalizeString(name)}|${normalizeString(team)}`;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseAge(ageStr) {
  if (!ageStr) return null;
  const match = ageStr.match(/^(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Erro: Especifique o caminho do CSV');
    console.log('Uso: node scripts/update-players-age-nationality.cjs <caminho-do-csv>');
    process.exit(1);
  }

  const csvPath = args[0];

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Erro: Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📂 Carregando players.json...');
  const playersData = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, 'utf-8'));
  
  const teamsPath = path.join(__dirname, '../src-tauri/resources/data/teams.json');
  const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

  console.log(`✅ Total de jogadores: ${playersData.Players.length}`);
  
  // Criar índice: nome+time -> índice no array
  const playerIndex = new Map();
  playersData.Players.forEach((player, idx) => {
    const key = normalizePlayerKey(player.Name, player.TeamId);
    playerIndex.set(key, idx);
  });

  // Criar índice de times
  const teamNameToId = new Map();
  teamsData.Teams.forEach(team => {
    const normalized = normalizeString(team.Name);
    teamNameToId.set(normalized, team.Id);
  });

  console.log(`📊 Lendo CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);

  let updated = 0;
  let notFound = 0;
  let alreadyHasData = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    const name = row['Jogador'];
    const teamName = row['Time'];
    const nationality = row['Nação'];
    const age = parseAge(row['Idade']);

    if (!name || !teamName) continue;

    // Buscar teamId
    const normalizedTeamName = normalizeString(teamName);
    let teamId = teamNameToId.get(normalizedTeamName);
    
    // Busca aproximada se não encontrou exato
    if (!teamId) {
      for (const [tName, tId] of teamNameToId.entries()) {
        if (tName.includes(normalizedTeamName) || normalizedTeamName.includes(tName)) {
          teamId = tId;
          break;
        }
      }
    }

    if (!teamId) {
      continue;
    }

    // Buscar jogador no índice
    const key = normalizePlayerKey(name, teamId);
    const playerIdx = playerIndex.get(key);

    if (playerIdx === undefined) {
      notFound++;
      continue;
    }

    const player = playersData.Players[playerIdx];

    // Verificar se já tem os dados
    const hadAge = player.Age !== undefined;
    const hadNationality = player.Nationality !== undefined;

    let modified = false;

    // Atualizar idade se não tiver
    if (!hadAge && age && age > 0) {
      player.Age = age;
      modified = true;
    }

    // Atualizar nacionalidade se não tiver
    if (!hadNationality && nationality && nationality.trim() !== '') {
      player.Nationality = nationality.trim();
      modified = true;
    }

    if (modified) {
      updated++;
      if (updated % 100 === 0) {
        console.log(`⏳ Atualizados: ${updated} jogadores...`);
      }
    } else if (hadAge && hadNationality) {
      alreadyHasData++;
    }
  }

  console.log('\n📊 Resumo da atualização:');
  console.log(`✅ Jogadores atualizados: ${updated}`);
  console.log(`✓  Jogadores que já tinham os dados: ${alreadyHasData}`);
  console.log(`⚠️  Jogadores do CSV não encontrados no banco: ${notFound}`);

  if (updated > 0) {
    console.log('\n💾 Salvando players.json...');
    fs.writeFileSync(PLAYERS_JSON_PATH, JSON.stringify(playersData, null, 2), 'utf-8');
    console.log('✅ Arquivo atualizado com sucesso!');
    console.log(`\n🎉 ${updated} jogadores agora têm idade e/ou nacionalidade!`);
  } else {
    console.log('\n⚠️  Nenhum jogador foi atualizado.');
  }
}

main();
