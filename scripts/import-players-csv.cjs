/**
 * Script para importar jogadores do CSV para players.json
 * 
 * Uso: node scripts/import-players-csv.js <caminho-do-csv>
 * Exemplo: node scripts/import-players-csv.js data/players-stats.csv
 */

const fs = require('fs');
const path = require('path');

// ========== CONFIGURAÇÕES ==========
const MIN_MINUTES = 90; // Filtrar jogadores com menos de 90 minutos jogados
const PLAYERS_JSON_PATH = path.join(__dirname, '../src-tauri/resources/data/players.json');

// ========== FUNÇÕES AUXILIARES ==========

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

function parseNumber(value) {
  if (!value) return 0;
  const cleaned = value.replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizePosition(pos) {
  const posMap = {
    'GK': 'GOL',
    'CB': 'ZAG',
    'LB': 'LAT-E',
    'RB': 'LAT-D',
    'DM': 'VOL',
    'CM': 'MEI',
    'CAM': 'MEI-A',
    'LW': 'PNT-E',
    'RW': 'PNT-D',
    'ST': 'ATA',
    'CF': 'SA',
    'FW': 'ATA',
    'DF': 'ZAG',
    'MF': 'MEI',
  };
  
  const upper = pos.toUpperCase();
  return posMap[upper] || 'MEI';
}

function deriveAttributes(stats, position) {
  const {
    age = 25,
    minutes = 0,
    goals = 0,
    assists = 0,
    shots = 0,
    shotsOnTarget = 0,
    passesCompleted = 0,
    passesAttempted = 0,
    progressivePasses = 0,
    carries = 0,
    progressiveCarries = 0,
    dribblesAttempted = 0,
    dribblesSuccessful = 0,
    blocks = 0,
    interceptions = 0,
    tackles = 0,
    xG = 0,
    xAG = 0,
  } = stats;

  // SPEED: Baseado em idade (jovens mais rápidos) + carries + progressive carries
  const ageSpeed = Math.max(40, 95 - (age - 18) * 1.5);
  const carrySpeed = Math.min(30, (carries / Math.max(minutes, 1)) * 1000);
  const speed = Math.round(Math.min(99, ageSpeed * 0.7 + carrySpeed * 0.3));

  // SHOOTING: Gols + xG + Chutes a gol
  const goalScore = Math.min(40, goals * 4);
  const xGScore = Math.min(30, xG * 3);
  const shotAccuracy = shots > 0 ? (shotsOnTarget / shots) * 30 : 0;
  const shooting = Math.round(Math.min(99, goalScore + xGScore + shotAccuracy));

  // PASSING: % Passes + Assists + xAG + Progressive Passes
  const passAccuracy = passesAttempted > 0 ? (passesCompleted / passesAttempted) * 40 : 50;
  const assistScore = Math.min(25, assists * 5);
  const xAGScore = Math.min(20, xAG * 4);
  const progScore = Math.min(15, (progressivePasses / Math.max(minutes, 1)) * 500);
  const passing = Math.round(Math.min(99, passAccuracy + assistScore + xAGScore + progScore));

  // DRIBBLING: % Dribles + Carries + Progressive Carries
  const dribbleSuccess = dribblesAttempted > 0 ? (dribblesSuccessful / dribblesAttempted) * 40 : 50;
  const carryScore = Math.min(30, (carries / Math.max(minutes, 1)) * 1000);
  const progCarryScore = Math.min(30, (progressiveCarries / Math.max(minutes, 1)) * 1000);
  const dribbling = Math.round(Math.min(99, dribbleSuccess + carryScore * 0.3 + progCarryScore * 0.3));

  // DEFENSE: Tackles + Interceptions + Blocks
  const tackleScore = Math.min(35, (tackles / Math.max(minutes, 1)) * 1000);
  const intScore = Math.min(35, (interceptions / Math.max(minutes, 1)) * 1000);
  const blockScore = Math.min(30, (blocks / Math.max(minutes, 1)) * 1000);
  const defense = Math.round(Math.min(99, tackleScore + intScore + blockScore));

  // STAMINA: Minutos jogados + idade inversa
  const minuteScore = Math.min(60, (minutes / 3000) * 60);
  const ageStamina = Math.max(20, 80 - (age - 18) * 1.2);
  const stamina = Math.round(Math.min(99, minuteScore + ageStamina * 0.4));

  // Ajuste por posição (goleiros não precisam de shooting alto, etc)
  const adjustedAttrs = adjustByPosition(
    { speed, shooting, passing, dribbling, defense, stamina },
    position
  );

  return adjustedAttrs;
}

function adjustByPosition(attrs, position) {
  const adjusted = { ...attrs };

  if (position === 'GOL') {
    // Goleiros: Defense alto, Shooting baixo
    adjusted.defense = Math.max(adjusted.defense, 70);
    adjusted.shooting = Math.min(adjusted.shooting, 40);
    adjusted.passing = Math.max(45, adjusted.passing * 0.8);
  } else if (['ZAG', 'LAT-E', 'LAT-D'].includes(position)) {
    // Defensores: Defense alto, Shooting baixo
    adjusted.defense = Math.max(adjusted.defense, 60);
    adjusted.shooting = Math.min(adjusted.shooting * 0.7, 70);
  } else if (['VOL', 'MEI'].includes(position)) {
    // Meio-campo: Passing alto, balanceado
    adjusted.passing = Math.max(adjusted.passing, 60);
  } else if (['ATA', 'SA', 'PNT-E', 'PNT-D'].includes(position)) {
    // Atacantes: Shooting alto, Defense baixo
    adjusted.shooting = Math.max(adjusted.shooting, 60);
    adjusted.defense = Math.min(adjusted.defense * 0.7, 60);
  }

  // Garantir valores entre 30 e 99
  Object.keys(adjusted).forEach(key => {
    adjusted[key] = Math.max(30, Math.min(99, Math.round(adjusted[key])));
  });

  return adjusted;
}

function parseAge(ageStr) {
  if (!ageStr) return 25;
  const match = ageStr.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 25;
}

function findTeamId(teamName, teamsData) {
  const normalized = normalizeString(teamName);
  
  for (const team of teamsData.Teams) {
    const teamNorm = normalizeString(team.Name);
    if (teamNorm === normalized || teamNorm.includes(normalized) || normalized.includes(teamNorm)) {
      return { teamId: team.Id, leagueId: team.LeagueId };
    }
  }
  
  return null;
}

function generatePlayerId(index) {
  return `p-csv-${String(index).padStart(6, '0')}`;
}

// ========== MAIN ==========

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Erro: Especifique o caminho do CSV');
    console.log('Uso: node scripts/import-players-csv.js <caminho-do-csv>');
    process.exit(1);
  }

  const csvPath = args[0];

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Erro: Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📂 Carregando dados existentes...');
  const playersData = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, 'utf-8'));
  const teamsPath = path.join(__dirname, '../src-tauri/resources/data/teams.json');
  const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

  // Criar índice de jogadores existentes
  const existingPlayers = new Set();
  playersData.Players.forEach(player => {
    const key = normalizePlayerKey(player.Name, player.TeamId);
    existingPlayers.add(key);
  });

  console.log(`✅ Jogadores existentes: ${existingPlayers.size}`);
  console.log(`📊 Lendo CSV: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);

  console.log(`📋 Cabeçalhos: ${headers.join(', ')}`);
  console.log(`📊 Total de linhas no CSV: ${lines.length - 1}`);

  let added = 0;
  let skipped = 0;
  let filtered = 0;
  let nextId = playersData.Players.length + 1;

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
    const minutes = parseNumber(row['Min.']);

    if (!name || !teamName) continue;

    // Filtrar jogadores com poucos minutos
    if (minutes < MIN_MINUTES) {
      filtered++;
      continue;
    }

    // Buscar time no banco de dados
    const teamMatch = findTeamId(teamName, teamsData);
    if (!teamMatch) {
      filtered++;
      continue;
    }

    // Verificar duplicata
    const key = normalizePlayerKey(name, teamMatch.teamId);
    if (existingPlayers.has(key)) {
      skipped++;
      continue;
    }

    // Extrair estatísticas
    const stats = {
      age: parseAge(row['Idade']),
      minutes: parseNumber(row['Min.']),
      goals: parseNumber(row['Gols']),
      assists: parseNumber(row['Assis.']),
      shots: parseNumber(row['TC']),
      shotsOnTarget: parseNumber(row['CaG']),
      passesCompleted: parseNumber(row['Cmp']),
      passesAttempted: parseNumber(row['Att']),
      progressivePasses: parseNumber(row['PrgP']),
      carries: parseNumber(row['Conduções']),
      progressiveCarries: parseNumber(row['PrgC']),
      dribblesAttempted: parseNumber(row['Tent']),
      dribblesSuccessful: parseNumber(row['Suc']),
      blocks: parseNumber(row['Bloqueios']),
      interceptions: parseNumber(row['Div']),
      tackles: parseNumber(row['Crts']),
      xG: parseNumber(row['xG']),
      xAG: parseNumber(row['xAG']),
    };

    const position = normalizePosition(row['Pos.'] || 'MF');
    const attributes = deriveAttributes(stats, position);
    const nationality = row['Nação'] || null;

    const newPlayer = {
      Id: generatePlayerId(nextId++),
      Name: name,
      Position: position,
      Speed: attributes.speed,
      Shooting: attributes.shooting,
      Passing: attributes.passing,
      Dribbling: attributes.dribbling,
      Defense: attributes.defense,
      Stamina: attributes.stamina,
      TeamId: teamMatch.teamId,
      LeagueId: teamMatch.leagueId,
      Status: 'Não Convocado',
    };

    // Adicionar campos opcionais apenas se existirem
    if (stats.age && stats.age > 0) {
      newPlayer.Age = stats.age;
    }
    if (nationality && nationality.trim() !== '') {
      newPlayer.Nationality = nationality.trim();
    }

    playersData.Players.push(newPlayer);
    existingPlayers.add(key);
    added++;

    if (added % 100 === 0) {
      console.log(`⏳ Processados: ${added} novos jogadores...`);
    }
  }

  console.log('\n📊 Resumo da importação:');
  console.log(`✅ Jogadores adicionados: ${added}`);
  console.log(`⏭️  Jogadores já existentes (pulados): ${skipped}`);
  console.log(`🚫 Jogadores filtrados (poucos minutos/time não cadastrado): ${filtered}`);
  console.log(`📦 Total final no banco: ${playersData.Players.length}`);

  if (added > 0) {
    console.log('\n💾 Salvando players.json...');
    fs.writeFileSync(PLAYERS_JSON_PATH, JSON.stringify(playersData, null, 2), 'utf-8');
    console.log('✅ Arquivo salvo com sucesso!');
  } else {
    console.log('\n⚠️  Nenhum jogador novo foi adicionado. Nada alterado.');
  }
}

main();
