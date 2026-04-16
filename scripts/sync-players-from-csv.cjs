/**
 * Script consolidado para sincronizar jogadores do CSV com o banco de dados
 * 
 * Funcionalidades:
 * - Mapeia times com variações de nome (Atlético-MG = Atlético Mineiro, etc.)
 * - Filtra CSV para processar apenas jogadores de times existentes em teams.json
 * - Atualiza jogadores existentes (idade, nacionalidade, atributos)
 * - Cria novos jogadores que não existem no banco
 * - Remove duplicados ao final
 * 
 * Uso: node scripts/sync-players-from-csv.cjs <caminho-do-csv>
 */

const fs = require('fs');
const path = require('path');

const PLAYERS_JSON_PATH = path.join(__dirname, '../src-tauri/resources/data/players.json');
const TEAMS_JSON_PATH = path.join(__dirname, '../src-tauri/resources/data/teams.json');
const MIN_MINUTES = 90; // Mínimo de minutos jogados para importar

// Mapeamento de variações de nomes de times
const TEAM_NAME_VARIATIONS = {
  'atletico-mg': ['atlético-mg', 'atletico mineiro', 'atlético mineiro', 'galo', 'cam'],
  'atletico-go': ['atlético-go', 'atletico goianiense', 'atlético goianiense', 'acg', 'dragão'],
  'atletico-pr': ['atlético-pr', 'atletico paranaense', 'atlético paranaense', 'cap', 'furacão'],
  'sao-paulo': ['são paulo', 'sao paulo', 'spfc', 'tricolor paulista'],
  'internacional': ['internacional', 'inter', 'sport club internacional', 'colorado'],
  'gremio': ['grêmio', 'gremio', 'grêmio fbpa', 'tricolor gaúcho'],
  'corinthians': ['corinthians', 'sport club corinthians', 'timão'],
  'palmeiras': ['palmeiras', 'sociedade esportiva palmeiras', 'verdão'],
  'flamengo': ['flamengo', 'clube de regatas do flamengo', 'mengão', 'crf'],
  'fluminense': ['fluminense', 'fluminense fc', 'tricolor carioca', 'flu'],
  'botafogo': ['botafogo', 'botafogo fr', 'fogão', 'glorioso'],
  'vasco': ['vasco', 'vasco da gama', 'club de regatas vasco da gama', 'gigante'],
  'santos': ['santos', 'santos fc', 'peixe'],
  'cruzeiro': ['cruzeiro', 'cruzeiro ec', 'raposa'],
  'bahia': ['bahia', 'esporte clube bahia', 'tricolor de aço'],
  'vitoria': ['vitória', 'vitoria', 'ec vitória', 'leão'],
  'sport': ['sport', 'sport recife', 'sport club do recife', 'leão da ilha'],
  'fortaleza': ['fortaleza', 'fortaleza ec', 'leão do pici'],
  'ceara': ['ceará', 'ceara', 'ceará sc', 'vovô'],
  'goias': ['goiás', 'goias', 'goiás ec', 'esmeraldino'],
  'cuiaba': ['cuiabá', 'cuiaba', 'cuiabá ec', 'dourado'],
  'bragantino': ['bragantino', 'red bull bragantino', 'massa bruta'],
  'america-mg': ['américa-mg', 'america-mg', 'américa mineiro', 'coelho'],
  'athletico-pr': ['athletico-pr', 'athletico paranaense', 'cap', 'furacão'],
  'coritiba': ['coritiba', 'coritiba fc', 'coxa'],
};

function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim();
}

function findTeamId(csvTeamName, teamNameToId) {
  const normalized = normalizeString(csvTeamName);
  
  // Busca exata
  if (teamNameToId.has(normalized)) {
    return teamNameToId.get(normalized);
  }
  
  // Busca com variações
  for (const [teamId, variations] of Object.entries(TEAM_NAME_VARIATIONS)) {
    for (const variation of variations) {
      const normVariation = normalizeString(variation);
      if (normVariation === normalized || 
          normalized.includes(normVariation) || 
          normVariation.includes(normalized)) {
        return teamId;
      }
    }
  }
  
  // Busca aproximada
  for (const [teamName, teamId] of teamNameToId.entries()) {
    if (teamName.includes(normalized) || normalized.includes(teamName)) {
      return teamId;
    }
  }
  
  return null;
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

function parseFloat01(str) {
  if (!str) return 0;
  const val = parseFloat(str.replace(',', '.'));
  return isNaN(val) ? 0 : val;
}

function deriveAttributes(stats, position) {
  const age = stats.age || 25;
  const minutes = stats.minutes || 0;
  const goals = stats.goals || 0;
  const assists = stats.assists || 0;
  const xG = stats.xG || 0;
  const xAG = stats.xAG || 0;
  const shotAccuracy = stats.shotAccuracy || 0;
  const passCompletion = stats.passCompletion || 0;
  const progressivePasses = stats.progressivePasses || 0;
  const carries = stats.carries || 0;
  const tackles = stats.tackles || 0;
  const interceptions = stats.interceptions || 0;
  const blocks = stats.blocks || 0;
  const aerials = stats.aerials || 0;

  const minutesFactor = Math.min(minutes / 1000, 2.5);

  // VELOCIDADE: baseada em idade + corridas + condução
  let speed = 95 - (Math.max(0, age - 18) * 1.5);
  speed += carries * 0.03;
  speed = Math.max(30, Math.min(99, Math.round(speed)));

  // FINALIZAÇÃO
  let shooting = 40;
  if (position === 'ST' || position === 'RW' || position === 'LW') {
    shooting = 45 + goals * 4 + xG * 3 + shotAccuracy * 30;
  } else if (position === 'CM' || position === 'AM') {
    shooting = 40 + goals * 5 + xG * 4 + shotAccuracy * 25;
  } else {
    shooting = 35 + goals * 6 + xG * 4 + shotAccuracy * 20;
  }
  shooting *= minutesFactor;
  shooting = Math.max(30, Math.min(99, Math.round(shooting)));

  // PASSE
  let passing = 40;
  passing += passCompletion * 40;
  passing += assists * 5;
  passing += xAG * 4;
  passing += progressivePasses * 0.5;
  passing *= minutesFactor;
  passing = Math.max(30, Math.min(99, Math.round(passing)));

  // DRIBLE
  let dribbling = 45;
  dribbling += carries * 0.05;
  dribbling += (assists + xAG) * 2;
  if (position === 'RW' || position === 'LW' || position === 'AM') {
    dribbling += 5;
  }
  dribbling *= minutesFactor;
  dribbling = Math.max(30, Math.min(99, Math.round(dribbling)));

  // DEFESA
  let defense = 35;
  defense += tackles * 1.5;
  defense += interceptions * 1.2;
  defense += blocks * 1.0;
  defense += aerials * 0.8;
  if (position === 'CB' || position === 'DM') {
    defense += 15;
  } else if (position === 'LB' || position === 'RB') {
    defense += 10;
  }
  defense *= minutesFactor;
  defense = Math.max(30, Math.min(99, Math.round(defense)));

  // RESISTÊNCIA
  let stamina = 50;
  stamina += Math.min(minutes / 50, 30);
  stamina += tackles * 0.3 + carries * 0.02;
  stamina -= Math.max(0, age - 30) * 2;
  stamina = Math.max(30, Math.min(99, Math.round(stamina)));

  return {
    speed,
    shooting,
    passing,
    dribbling,
    defense,
    stamina,
  };
}

function mapPosition(csvPosition) {
  const pos = csvPosition.toUpperCase().trim();
  
  if (pos.includes('GK')) return 'GOL';
  
  if (pos.includes('CB') || pos.includes('DF')) return 'ZAG';
  if (pos.includes('LB') || pos.includes('RB') || pos.includes('WB')) return 'LAT';
  
  if (pos.includes('DM') || pos.includes('CDM')) return 'VOL';
  if (pos.includes('CM') || pos.includes('MF')) return 'MEI';
  if (pos.includes('AM') || pos.includes('CAM')) return 'MEI';
  
  if (pos.includes('FW') || pos.includes('ST') || pos.includes('CF')) return 'ATA';
  if (pos.includes('LW') || pos.includes('RW')) return 'ATA';
  
  return 'MEI'; // fallback
}

function generatePlayerId(name, teamId) {
  const normalized = normalizeString(name).replace(/\s+/g, '-');
  const random = Math.random().toString(36).substring(2, 6);
  return `p-${normalized}-${teamId}-${random}`;
}

function normalizePlayerKey(name, teamId) {
  return `${normalizeString(name)}|${teamId}`;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Erro: Especifique o caminho do CSV');
    console.log('Uso: node scripts/sync-players-from-csv.cjs <caminho-do-csv>');
    process.exit(1);
  }

  const csvPath = args[0];

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Erro: Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📂 Carregando dados...');
  const playersData = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, 'utf-8'));
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_JSON_PATH, 'utf-8'));

  console.log(`✅ Jogadores atuais: ${playersData.Players.length}`);
  console.log(`✅ Times no banco: ${teamsData.Teams.length}`);

  // Criar índice de times
  const teamNameToId = new Map();
  const validTeamIds = new Set();
  
  teamsData.Teams.forEach(team => {
    const normalized = normalizeString(team.Name);
    teamNameToId.set(normalized, team.Id);
    validTeamIds.add(team.Id);
  });

  // Criar índice de jogadores existentes: nome+time -> jogador
  const playerIndex = new Map();
  playersData.Players.forEach((player) => {
    const key = normalizePlayerKey(player.Name, player.TeamId);
    playerIndex.set(key, player);
  });

  console.log(`\n📊 Processando CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);

  // ETAPA 1: Agrupar jogos por jogador
  console.log('📊 Agrupando jogos por jogador...');
  const playerGames = new Map(); // key: nome|time -> array de jogos

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
    
    if (!name || !teamName) continue;

    const key = `${normalizeString(name)}|${normalizeString(teamName)}`;
    
    if (!playerGames.has(key)) {
      playerGames.set(key, []);
    }
    
    playerGames.get(key).push(row);
  }

  console.log(`✅ ${playerGames.size} jogadores únicos encontrados no CSV`);

  // ETAPA 2: Processar jogadores agrupados
  let updated = 0;
  let created = 0;
  let skipped = 0;
  let filteredByTeam = 0;
  let filteredByMinutes = 0;

  const newPlayers = [];

  for (const [key, games] of playerGames.entries()) {
    const firstGame = games[0];
    const name = firstGame['Jogador'];
    const teamName = firstGame['Time'];
    const position = firstGame['Posição'] || firstGame['Pos.'];
    const nationality = firstGame['Nação'];
    const age = parseAge(firstGame['Idade']);

    if (!name || !teamName || !position) continue;

    // Buscar teamId
    const teamId = findTeamId(teamName, teamNameToId);

    if (!teamId) {
      filteredByTeam++;
      continue;
    }

    // SOMAR estatísticas de todos os jogos
    let totalMinutes = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalXG = 0;
    let totalXAG = 0;
    let totalShots = 0;
    let totalShotsOnTarget = 0;
    let totalPasses = 0;
    let totalPassesCompleted = 0;
    let totalProgressivePasses = 0;
    let totalCarries = 0;
    let totalTackles = 0;
    let totalInterceptions = 0;
    let totalBlocks = 0;
    let totalAerialWins = 0;
    let totalAerials = 0;

    for (const game of games) {
      totalMinutes += parseFloat01(game['Min.']);
      totalGoals += parseFloat01(game['Gols']);
      totalAssists += parseFloat01(game['Assis.']);
      totalXG += parseFloat01(game['xG']);
      totalXAG += parseFloat01(game['xAG']);
      totalShots += parseFloat01(game['TC']);
      totalShotsOnTarget += parseFloat01(game['CaG']);
      totalPasses += parseFloat01(game['Att']);
      totalPassesCompleted += parseFloat01(game['Cmp']);
      totalProgressivePasses += parseFloat01(game['PrgP']);
      totalCarries += parseFloat01(game['Conduções']);
      totalTackles += parseFloat01(game['Div']);
      totalInterceptions += parseFloat01(game['Int']);
      totalBlocks += parseFloat01(game['Bloqueios']);
      
      const aerials = parseFloat01(game['Te']) || 0;
      const aerialWinPct = parseFloat01(game['TW%']) || 0;
      totalAerials += aerials;
      totalAerialWins += (aerials * aerialWinPct / 100);
    }

    // Filtrar por minutos mínimos
    if (totalMinutes < MIN_MINUTES) {
      filteredByMinutes++;
      continue;
    }

    const shotAccuracy = totalShots > 0 ? totalShotsOnTarget / totalShots : 0;
    const passCompletion = totalPasses > 0 ? totalPassesCompleted / totalPasses : 0;

    // Coletar estatísticas agregadas para derivar atributos
    const stats = {
      age: age || 25,
      minutes: totalMinutes,
      goals: totalGoals,
      assists: totalAssists,
      xG: totalXG,
      xAG: totalXAG,
      shotAccuracy: shotAccuracy,
      passCompletion: passCompletion,
      progressivePasses: totalProgressivePasses,
      carries: totalCarries,
      tackles: totalTackles,
      interceptions: totalInterceptions,
      blocks: totalBlocks,
      aerials: totalAerialWins,
    };

    const gamePosition = mapPosition(position);
    const attributes = deriveAttributes(stats, position);

    // Verificar se jogador já existe
    const key = normalizePlayerKey(name, teamId);
    const existingPlayer = playerIndex.get(key);

    if (existingPlayer) {
      // ATUALIZAR jogador existente
      let modified = false;

      if (!existingPlayer.Age && age) {
        existingPlayer.Age = age;
        modified = true;
      }

      if (!existingPlayer.Nationality && nationality) {
        existingPlayer.Nationality = nationality.trim();
        modified = true;
      }

      // Atualizar atributos se forem melhores
      const shouldUpdate = (
        attributes.speed > (existingPlayer.Speed || 0) ||
        attributes.shooting > (existingPlayer.Shooting || 0) ||
        attributes.passing > (existingPlayer.Passing || 0)
      );

      if (shouldUpdate) {
        existingPlayer.Speed = Math.max(existingPlayer.Speed, attributes.speed);
        existingPlayer.Shooting = Math.max(existingPlayer.Shooting, attributes.shooting);
        existingPlayer.Passing = Math.max(existingPlayer.Passing, attributes.passing);
        existingPlayer.Dribbling = Math.max(existingPlayer.Dribbling, attributes.dribbling);
        existingPlayer.Defense = Math.max(existingPlayer.Defense, attributes.defense);
        existingPlayer.Stamina = Math.max(existingPlayer.Stamina, attributes.stamina);
        modified = true;
      }

      if (modified) {
        updated++;
        if (updated % 50 === 0) {
          console.log(`⏳ Atualizados: ${updated}...`);
        }
      }
    } else {
      // CRIAR novo jogador
      const newPlayer = {
        Id: generatePlayerId(name, teamId),
        Name: name,
        Position: gamePosition,
        Speed: attributes.speed,
        Shooting: attributes.shooting,
        Passing: attributes.passing,
        Dribbling: attributes.dribbling,
        Defense: attributes.defense,
        Stamina: attributes.stamina,
        TeamId: teamId,
        LeagueId: teamsData.Teams.find(t => t.Id === teamId)?.LeagueId || 'bra-serie-a',
        Status: 'Não Convocado',
      };

      if (age) newPlayer.Age = age;
      if (nationality) newPlayer.Nationality = nationality.trim();

      newPlayers.push(newPlayer);
      playerIndex.set(key, newPlayer);
      created++;

      if (created % 50 === 0) {
        console.log(`⏳ Criados: ${created}...`);
      }
    }
  }

  // Adicionar novos jogadores ao array
  if (created > 0) {
    playersData.Players.push(...newPlayers);
  }

  console.log('\n🧹 Removendo duplicados...');
  const seen = new Set();
  const uniquePlayers = [];
  let duplicatesRemoved = 0;

  for (const player of playersData.Players) {
    const key = normalizePlayerKey(player.Name, player.TeamId);
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlayers.push(player);
    } else {
      duplicatesRemoved++;
    }
  }

  playersData.Players = uniquePlayers;

  console.log('\n📊 Resumo da sincronização:');
  console.log(`✅ Jogadores atualizados: ${updated}`);
  console.log(`🆕 Jogadores criados: ${created}`);
  console.log(`🚫 Duplicados removidos: ${duplicatesRemoved}`);
  console.log(`⚠️  Filtrados (time não existe): ${filteredByTeam}`);
  console.log(`⚠️  Filtrados (minutos < ${MIN_MINUTES}): ${filteredByMinutes}`);
  console.log(`\n📈 Total final: ${playersData.Players.length} jogadores`);

  if (updated > 0 || created > 0 || duplicatesRemoved > 0) {
    console.log('\n💾 Salvando players.json...');
    fs.writeFileSync(PLAYERS_JSON_PATH, JSON.stringify(playersData, null, 2), 'utf-8');
    console.log('✅ Arquivo atualizado com sucesso!');
  } else {
    console.log('\n⚠️  Nenhuma alteração necessária.');
  }
}

main();
