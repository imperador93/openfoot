use crate::engine::match_engine::{simulate_full, simulate_silent, EventType, MatchPlayer, TeamSide};
use crate::models::energy::{energy_drain, energy_recovery};
use crate::models::{Coach, League, Player};
use crate::models::lineup::SavedLineup;
use crate::models::tactics::Tactics;
use rand::Rng;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TeamMeta {
    id: String,
    name: String,
    stadium: String,
    squad: Vec<Player>,
    coach: Option<Coach>,
    #[serde(default)]
    budget: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScheduledMatch {
    home_idx: usize,
    away_idx: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Standing {
    played: u32,
    wins: u32,
    draws: u32,
    losses: u32,
    goals_for: i32,
    goals_against: i32,
    points: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeagueSeasonState {
    league_id: String,
    pub current_round: usize,
    teams: Vec<TeamMeta>,
    schedule: Vec<Vec<ScheduledMatch>>,
    table: HashMap<String, Standing>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerState {
    pub player_team_id: String,
    pub player_league_id: String,
    pub coach_name: String,
    pub morale: i32,
    /// Contador de sequência: positivo = vitórias, negativo = derrotas, 0 = sem sequência
    pub result_streak: i32,
    /// Ano atual da carreira (incrementa a cada temporada)
    pub current_season: u32,
  /// Histórico de títulos: ano → (liga_id, posição)
    pub titles_history: Vec<(u32, String, u32)>,
    pub active_league_ids: Vec<String>,
    pub seasons: HashMap<String, LeagueSeasonState>,
    /// Energia atual de cada jogador do time do jogador (playerId → 0..100).
    pub player_energy: HashMap<String, f64>,
    /// Orçamento do time do jogador (persistente através das temporadas)
    #[serde(default)]
    pub player_team_budget: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableEntryDto {
    team_id: String,
    team_name: String,
    played: u32,
    wins: u32,
    draws: u32,
    losses: u32,
    goals_for: i32,
    goals_against: i32,
    goal_diff: i32,
    points: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureDto {
    home_team_id: String,
    home_team_name: String,
    home_stadium: String,
    home_coach_name: String,
    away_team_id: String,
    away_team_name: String,
    away_coach_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchEventDto {
    minute: u32,
    event_type: String, // "goal" | "nearMiss" | "save" | "foul" | "yellowCard" | "redCard"
    team_side: String,  // "home" | "away"
    team_name: String,
    player_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundMatchDto {
    home_team_id: String,
    home_team_name: String,
    home_coach_name: String,
    home_goals: i32,
    away_team_id: String,
    away_team_name: String,
    away_coach_name: String,
    away_goals: i32,
    events: Vec<MatchEventDto>,
    /// Energia dos jogadores que integraram o elenco original (titular ou reserva) após esta partida.
    player_energy_after: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundLeagueSnapshotDto {
    league_id: String,
    current_round: u32,
    total_rounds: u32,
    leader_team_name: String,
    leader_points: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CareerSnapshotDto {
    league_id: String,
    player_team_id: String,
    coach_name: String,
    morale: i32,
    current_season: u32,
    is_season_ended: bool,
    active_league_ids: Vec<String>,
    current_round: u32,
    total_rounds: u32,
    player_position: u32,
    player_team_budget: i64,
    league_division_level: u8,
    next_match_date: String,
    table: Vec<TableEntryDto>,
    next_round_fixtures: Vec<FixtureDto>,
    background_leagues: Vec<BackgroundLeagueSnapshotDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundGoalEventDto {
    minute: u32,
    home_team_name: String,
    away_team_name: String,
    home_goals: i32,
    away_goals: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundMatchDto {
    home_team_name: String,
    away_team_name: String,
    home_goals: i32,
    away_goals: i32,
    goal_events: Vec<BackgroundGoalEventDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundLeagueRoundDto {
    league_id: String,
    played_round: u32,
    leader_team_name: String,
    leader_points: u32,
    matches: Vec<BackgroundMatchDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateRoundResultDto {
    played_round: u32,
    matches: Vec<RoundMatchDto>,
    background_leagues: Vec<BackgroundLeagueRoundDto>,
    snapshot: CareerSnapshotDto,
    /// Energia de todos os jogadores do time do jogador após a rodada.
    player_energy_after: HashMap<String, f64>,
    /// Se o técnico (jogador) foi demitido após esta rodada devido à moral baixa.
    dismissed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarMatchDto {
    home_team_id: String,
    home_team_name: String,
    away_team_id: String,
    away_team_name: String,
    home_goals: Option<i32>,
    away_goals: Option<i32>,
    is_player_match: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarRoundDto {
    round_number: u32,
    matches: Vec<CalendarMatchDto>,
    is_played: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDataDto {
    league_id: String,
    league_name: String,
    player_team_id: String,
    current_round: u32,
    total_rounds: u32,
    current_season: u32,
    rounds: Vec<CalendarRoundDto>,
}

pub fn start_career(league: &League, player_team_id: &str) -> Result<CareerState, String> {
    let mut league_map = HashMap::new();
    league_map.insert(league.id.clone(), league.clone());
    start_career_multi(
        &league_map,
        &league.id,
        player_team_id,
        std::slice::from_ref(&league.id),
        "Treinador",
    )
}

pub fn start_career_multi(
    leagues: &HashMap<String, League>,
    player_league_id: &str,
    player_team_id: &str,
    active_league_ids: &[String],
    coach_name: &str,
) -> Result<CareerState, String> {
    let mut dedup_active: Vec<String> = Vec::new();

    for league_id in active_league_ids {
        if dedup_active.iter().all(|id| !id.eq_ignore_ascii_case(league_id)) {
            dedup_active.push(league_id.clone());
        }
    }

    if dedup_active
        .iter()
        .all(|id| !id.eq_ignore_ascii_case(player_league_id))
    {
        dedup_active.push(player_league_id.to_string());
    }

    // Expandir para incluir divisões conectadas (superior e inferior)
    // Isso permite rebaixamento/acesso automático
    let mut expanded_league_ids = dedup_active.clone();
    for league_id in &dedup_active {
        if let Some(league) = leagues.get(league_id) {
            // Adicionar divisão inferior se existir
            if let Some(lower_id) = &league.lower_division_id {
                if expanded_league_ids.iter().all(|id| !id.eq_ignore_ascii_case(lower_id)) {
                    expanded_league_ids.push(lower_id.clone());
                }
            }
            // Adicionar divisão superior se existir
            if let Some(upper_id) = &league.upper_division_id {
                if expanded_league_ids.iter().all(|id| !id.eq_ignore_ascii_case(upper_id)) {
                    expanded_league_ids.push(upper_id.clone());
                }
            }
        }
    }

    let mut seasons = HashMap::new();

    for league_id in &expanded_league_ids {
        let league = leagues
            .get(league_id)
            .ok_or_else(|| format!("Liga '{}' nao encontrada", league_id))?;

        let season = build_league_season(league)?;
        seasons.insert(league_id.clone(), season);
    }

    let player_season = seasons
        .get(player_league_id)
        .ok_or_else(|| format!("Liga '{}' nao encontrada", player_league_id))?;

    if !player_season
        .teams
        .iter()
        .any(|team| team.id.eq_ignore_ascii_case(player_team_id))
    {
        return Err(format!("Time '{}' nao encontrado na liga", player_team_id));
    }

    // Inicializar energia de todos os jogadores do time do jogador em 100
    let player_squad = seasons
        .get(player_league_id)
        .and_then(|s| s.teams.iter().find(|t| t.id.eq_ignore_ascii_case(player_team_id)))
        .map(|t| &t.squad);

    let player_energy: HashMap<String, f64> = player_squad
        .map(|squad| squad.iter().map(|p| (p.id.clone(), 100.0)).collect())
        .unwrap_or_default();

    // Inicializar orçamento do time do jogador (budget inicial calculado)
    let player_team_budget = seasons
        .get(player_league_id)
        .and_then(|s| s.teams.iter().find(|t| t.id.eq_ignore_ascii_case(player_team_id)))
        .and_then(|t| t.budget)
        .unwrap_or(0);

    Ok(CareerState {
        player_team_id: player_team_id.to_string(),
        player_league_id: player_league_id.to_string(),
        coach_name: coach_name.to_string(),
        morale: 75,
        result_streak: 0,
        current_season: 1,
        titles_history: Vec::new(),
        active_league_ids: expanded_league_ids,
        seasons,
        player_energy,
        player_team_budget,
    })
}

pub fn snapshot(state: &CareerState, all_leagues: &HashMap<String, League>) -> CareerSnapshotDto {
    let player_season = state
        .seasons
        .get(&state.player_league_id)
        .expect("BUG: player league season not found in career state - invalid state");

    let table_rows = sorted_table_rows(player_season);

    let next_round_fixtures = player_season
        .schedule
        .get(player_season.current_round)
        .map(|matches| {
            matches
                .iter()
                .map(|m| {
                    let home_team = &player_season.teams[m.home_idx];
                    let away_team = &player_season.teams[m.away_idx];
                    
                    let is_home_player = home_team.id.eq_ignore_ascii_case(&state.player_team_id);
                    let is_away_player = away_team.id.eq_ignore_ascii_case(&state.player_team_id);
                    
                    let home_coach_name = if is_home_player {
                        state.coach_name.clone()
                    } else {
                        home_team.coach.as_ref().map(|c| c.name.clone()).unwrap_or_default()
                    };
                    
                    let away_coach_name = if is_away_player {
                        state.coach_name.clone()
                    } else {
                        away_team.coach.as_ref().map(|c| c.name.clone()).unwrap_or_default()
                    };
                    
                    FixtureDto {
                        home_team_id: home_team.id.clone(),
                        home_team_name: home_team.name.clone(),
                        home_stadium: home_team.stadium.clone(),
                        home_coach_name,
                        away_team_id: away_team.id.clone(),
                        away_team_name: away_team.name.clone(),
                        away_coach_name,
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    // Posicao do jogador na tabela
    let player_position = table_rows
        .iter()
        .position(|row| row.team_id.eq_ignore_ascii_case(&state.player_team_id))
        .map(|idx| idx as u32 + 1)
        .unwrap_or(0);

    // Data gerada - temporada comeca em 01/02, +7 dias por rodada
    let season_year = 2026 + (state.current_season - 1) as i32;
    let season_start = chrono::NaiveDate::from_ymd_opt(season_year, 2, 1)
        .expect("BUG: invalid hardcoded season start date");
    let round_date = season_start + chrono::Duration::weeks(player_season.current_round as i64);
    let next_match_date = round_date.format("%d/%m/%Y").to_string();

    let mut background_leagues: Vec<BackgroundLeagueSnapshotDto> = state
        .active_league_ids
        .iter()
        .filter(|league_id| !league_id.eq_ignore_ascii_case(&state.player_league_id))
        .filter_map(|league_id| {
            state.seasons.get(league_id).map(|season| {
                let leader = season_leader(season);
                BackgroundLeagueSnapshotDto {
                    league_id: season.league_id.clone(),
                    current_round: season.current_round as u32,
                    total_rounds: season.schedule.len() as u32,
                    leader_team_name: leader.0,
                    leader_points: leader.1,
                }
            })
        })
        .collect();

    background_leagues.sort_by(|a, b| a.league_id.cmp(&b.league_id));

    let is_season_ended = player_season.current_round >= player_season.schedule.len();

    // Buscar division_level da liga atual
    let league_division_level = all_leagues
        .get(&state.player_league_id)
        .map(|league| league.division_level)
        .unwrap_or(1);

    CareerSnapshotDto {
        league_id: state.player_league_id.clone(),
        player_team_id: state.player_team_id.clone(),
        coach_name: state.coach_name.clone(),
        morale: state.morale,
        current_season: state.current_season,
        is_season_ended,
        active_league_ids: state.active_league_ids.clone(),
        current_round: player_season.current_round as u32,
        total_rounds: player_season.schedule.len() as u32,
        player_position,
        player_team_budget: state.player_team_budget,
        league_division_level,
        next_match_date,
        table: table_rows,
        next_round_fixtures,
        background_leagues,
    }
}

/// Inicia uma nova temporada: reseta tabela, gera novo calendário, incrementa temporada
/// Registra título/vice se aplicável
pub fn start_new_season(
    state: &mut CareerState,
    all_leagues: &HashMap<String, League>,
) -> Result<CareerSnapshotDto, String> {
    // Registrar posição final da temporada anterior no histórico
    if let Some(player_season) = state.seasons.get(&state.player_league_id) {
        let final_standings = sorted_table_rows(player_season);
        if let Some(final_position) = final_standings
            .iter()
            .position(|entry| entry.team_id.eq_ignore_ascii_case(&state.player_team_id))
        {
            let final_pos = (final_position + 1) as u32;
            state.titles_history.push((
                state.current_season,
                state.player_league_id.clone(),
                final_pos,
            ));
        }
    }

    // REBAIXAMENTO/PROMOÇÃO: Trocar times entre divisões do mesmo país
    let player_country = all_leagues
        .get(&state.player_league_id)
        .map(|l| l.country.clone())
        .unwrap_or_default();

    // Encontrar todas as divisões conectadas ativas do país do jogador
    let mut division_pairs: Vec<(String, String)> = Vec::new();
    
    for league_id in &state.active_league_ids.clone() {
        if let Some(league) = all_leagues.get(league_id) {
            if league.country == player_country {
                // Se tem divisão inferior E essa divisão está ativa
                if let Some(lower_id) = &league.lower_division_id {
                    if state.active_league_ids.contains(lower_id) {
                        division_pairs.push((league_id.clone(), lower_id.clone()));
                    }
                }
            }
        }
    }

    // Processar rebaixamento/promoção para cada par de divisões
    for (upper_id, lower_id) in division_pairs {
        // Obter tabelas finais de ambas divisões
        let upper_table = state.seasons.get(&upper_id)
            .map(sorted_table_rows)
            .unwrap_or_default();
        let lower_table = state.seasons.get(&lower_id)
            .map(sorted_table_rows)
            .unwrap_or_default();

        // Identificar times a rebaixar (4 últimos da superior)
        let relegated_ids: Vec<String> = upper_table
            .iter()
            .rev()
            .take(4)
            .map(|e| e.team_id.clone())
            .collect();

        // Identificar times a promover (4 primeiros da inferior)
        let promoted_ids: Vec<String> = lower_table
            .iter()
            .take(4)
            .map(|e| e.team_id.clone())
            .collect();

        // Extrair os times que vão trocar de divisão
        let mut teams_to_relegate: Vec<TeamMeta> = Vec::new();
        let mut teams_to_promote: Vec<TeamMeta> = Vec::new();

        if let Some(upper_season) = state.seasons.get_mut(&upper_id) {
            upper_season.teams.retain(|t| {
                if relegated_ids.contains(&t.id) {
                    teams_to_relegate.push(t.clone());
                    false
                } else {
                    true
                }
            });
        }

        if let Some(lower_season) = state.seasons.get_mut(&lower_id) {
            lower_season.teams.retain(|t| {
                if promoted_ids.contains(&t.id) {
                    teams_to_promote.push(t.clone());
                    false
                } else {
                    true
                }
            });
        }

        // Adicionar times nas novas divisões
        if let Some(upper_season) = state.seasons.get_mut(&upper_id) {
            for team in teams_to_promote {
                upper_season.teams.push(team);
            }
        }

        if let Some(lower_season) = state.seasons.get_mut(&lower_id) {
            for team in teams_to_relegate {
                lower_season.teams.push(team);
            }
        }

        // Atualizar liga do jogador se ele foi rebaixado/promovido
        if relegated_ids.contains(&state.player_team_id) {
            state.player_league_id = lower_id.clone();
        } else if promoted_ids.contains(&state.player_team_id) {
            state.player_league_id = upper_id.clone();
        }
    }

    // Incrementar temporada
    state.current_season += 1;
    state.result_streak = 0;

    // Resetar energia dos jogadores
    for energy in state.player_energy.values_mut() {
        *energy = 100.0;
    }

    // Resetar tabela, calendário e rodada de todas as ligas MANTENDO os times atuais
    for league_id in &state.active_league_ids.clone() {
        if let Some(season) = state.seasons.get_mut(league_id) {
            // Gerar novo calendário com os times ATUAIS (já com rebaixados/promovidos)
            let schedule = generate_schedule(season.teams.len());
            
            // Resetar tabela
            let mut table = HashMap::new();
            for team in &season.teams {
                table.insert(team.id.clone(), Standing::default());
            }
            
            season.schedule = schedule;
            season.table = table;
            season.current_round = 0;
        }
    }

    Ok(snapshot(state, all_leagues))
}

pub fn get_calendar_data(state: &CareerState) -> Result<CalendarDataDto, String> {
    let player_season = state
        .seasons
        .get(&state.player_league_id)
        .ok_or_else(|| format!("Liga '{}' não encontrada", state.player_league_id))?;

    let league_name = player_season.teams.first()
        .map(|t| {
            // Tenta inferir o nome da liga pelo primeiro time (simplificação)
            // TODO: Armazenar o nome da liga em LeagueSeasonState
            state.player_league_id.clone()
        })
        .unwrap_or_else(|| state.player_league_id.clone());

    let current_round = player_season.current_round;
    let total_rounds = player_season.schedule.len();

    let mut rounds = Vec::new();

    for (round_idx, round_matches) in player_season.schedule.iter().enumerate() {
        let round_number = (round_idx + 1) as u32;
        let is_played = round_idx < current_round;

        let matches = round_matches
            .iter()
            .map(|m| {
                let home = &player_season.teams[m.home_idx];
                let away = &player_season.teams[m.away_idx];

                let is_player_match = home.id.eq_ignore_ascii_case(&state.player_team_id)
                    || away.id.eq_ignore_ascii_case(&state.player_team_id);

                // TODO: Armazenar placares históricos para mostrar resultados
                // Por enquanto, jogos já jogados também terão null
                CalendarMatchDto {
                    home_team_id: home.id.clone(),
                    home_team_name: home.name.clone(),
                    away_team_id: away.id.clone(),
                    away_team_name: away.name.clone(),
                    home_goals: None,
                    away_goals: None,
                    is_player_match,
                }
            })
            .collect();

        rounds.push(CalendarRoundDto {
            round_number,
            matches,
            is_played,
        });
    }

    Ok(CalendarDataDto {
        league_id: state.player_league_id.clone(),
        league_name,
        player_team_id: state.player_team_id.clone(),
        current_round: (current_round + 1) as u32,
        total_rounds: total_rounds as u32,
        current_season: state.current_season,
        rounds,
    })
}

fn best_eleven(squad: &[Player]) -> Vec<Player> {
    let mut sorted = squad.to_vec();
    sorted.sort_by(|a, b| b.overall().cmp(&a.overall()));
    sorted.truncate(11);
    sorted
}

fn squad_for_match(squad: &[Player], lineup: &SavedLineup) -> Vec<Player> {
    let lineup_ids = lineup.starter_ids();
    if lineup_ids.is_empty() {
        return best_eleven(squad);
    }
    let filtered: Vec<Player> = squad
        .iter()
        .filter(|p| lineup_ids.iter().any(|id| id.eq_ignore_ascii_case(&p.id)))
        .cloned()
        .collect();
    if filtered.is_empty() {
        return best_eleven(squad);
    }
    filtered
}

/// Resultado de uma partida para cálculo de moral
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MatchResult {
    Win,
    Draw,
    Loss,
}

/// Calcula a mudança de moral baseada no resultado da partida e contexto
/// 
/// # Regras:
/// - Vitória: +8% base
/// - Empate: -1% base
/// - Derrota: -4% base
/// - Sequências amplificam o efeito (+1% adicional por jogo na sequência, até +4%)
/// - Posição na tabela: Top 6 = +2%, últimos 4 = -2% (aplicado a cada 5 rodadas)
/// 
/// # Retorna
/// (nova_moral, novo_streak)
fn calculate_morale_change(
    current_morale: i32,
    current_streak: i32,
    result: MatchResult,
    position: u32,
    current_round: u32,
) -> (i32, i32) {
    // Variação base (valores suavizados)
    let base_change = match result {
        MatchResult::Win => 8,
        MatchResult::Draw => -1,
        MatchResult::Loss => -4,
    };

    // Atualizar streak
    let new_streak = match result {
        MatchResult::Win => {
            if current_streak >= 0 {
                current_streak + 1 // Continua ou inicia win streak
            } else {
                1 // Quebra loss streak, inicia win streak
            }
        }
        MatchResult::Loss => {
            if current_streak <= 0 {
                current_streak - 1 // Continua ou inicia loss streak
            } else {
                -1 // Quebra win streak, inicia loss streak
            }
        }
        MatchResult::Draw => 0, // Empate quebra qualquer streak
    };

    // Bônus de sequência (máximo +4%)
    let streak_bonus = match result {
        MatchResult::Win => {
            let streak_count = new_streak.max(0);
            if streak_count >= 2 {
                (streak_count - 1).min(4) // 2 wins = +1%, 3 wins = +2%, ..., até +4%
            } else {
                0
            }
        }
        MatchResult::Loss => {
            let streak_count = (-new_streak).max(0);
            if streak_count >= 2 {
                -((streak_count - 1).min(4)) // 2 losses = -1%, 3 losses = -2%, ..., até -4%
            } else {
                0
            }
        }
        MatchResult::Draw => 0,
    };

    // Bônus/penalidade de posição na tabela (aplicado a cada 5 rodadas, valores suavizados)
    let position_modifier = if current_round % 5 == 0 {
        if position <= 6 {
            2 // Top 6: +2%
        } else if position >= 17 {
            -2 // Últimos 4: -2% (suavizado de -3%)
        } else {
            0
        }
    } else {
        0
    };

    // Calcular nova moral
    let total_change = base_change + streak_bonus + position_modifier;
    let new_morale = (current_morale + total_change).clamp(0, 100);

    (new_morale, new_streak)
}

/// Calcula a chance de demissão baseada na moral atual
/// 
/// # Regras:
/// - Moral >= 25%: 0% de chance de demissão
/// - Moral < 25%: chance aumenta linearmente
/// - Moral = 5%: 80% de chance
/// - Moral = 0%: 100% de chance
/// 
/// # Fórmula
/// Se moral < 25: chance = (25 - moral) / 20 * 80
/// Se moral = 0: força 100%
/// 
/// # Retorna
/// Probabilidade de demissão (0.0 a 1.0)
fn calculate_dismissal_chance(morale: i32) -> f64 {
    if morale >= 25 {
        return 0.0;
    }
    
    if morale == 0 {
        return 1.0; // 100% de chance se moral zerou
    }
    
    // Interpolação linear: 25% → 0%, 5% → 80%, 0% → 100%
    let chance = ((25 - morale) as f64 / 20.0) * 0.8;
    chance.min(1.0)
}

pub fn simulate_next_round(
    state: &mut CareerState,
    lineup: &SavedLineup,
    tactics: Tactics,
    all_leagues: &HashMap<String, League>,
) -> Result<SimulateRoundResultDto, String> {
    let (player_results, played_round) = {
        let player_season = state
            .seasons
            .get_mut(&state.player_league_id)
            .ok_or_else(|| format!("Liga '{}' nao encontrada", state.player_league_id))?;

        let round_matches = player_season
            .schedule
            .get(player_season.current_round)
            .cloned()
            .ok_or_else(|| "Temporada encerrada".to_string())?;

        let played_round = player_season.current_round + 1;
        let player_team_id = state.player_team_id.clone();
        let mut player_results = Vec::with_capacity(round_matches.len());

        let lineup_slot_zones = lineup.starter_slot_zones();
        let starter_ids: std::collections::HashSet<String> = lineup
            .starters
            .iter()
            .map(|s| s.player_id.to_lowercase())
            .collect();
        let bench_ids: std::collections::HashSet<String> = lineup
            .bench
            .iter()
            .map(|id| id.to_lowercase())
            .collect();

        for m in &round_matches {
            let home = &player_season.teams[m.home_idx];
            let away = &player_season.teams[m.away_idx];

            let is_player_home = home.id.eq_ignore_ascii_case(&player_team_id);
            let is_player_away = away.id.eq_ignore_ascii_case(&player_team_id);

            // Converter Vec<Player> em Vec<MatchPlayer> injetando energia corrente
            let home_match_squad: Vec<MatchPlayer> = if is_player_home {
                squad_for_match(&home.squad, lineup)
                    .into_iter()
                    .map(|p| {
                        let energy = state.player_energy.get(&p.id).copied().unwrap_or(100.0);
                        MatchPlayer { player: p, energy }
                    })
                    .collect()
            } else {
                best_eleven(&home.squad)
                    .into_iter()
                    .map(|p| MatchPlayer { player: p, energy: 100.0 })
                    .collect()
            };

            let away_match_squad: Vec<MatchPlayer> = if is_player_away {
                squad_for_match(&away.squad, lineup)
                    .into_iter()
                    .map(|p| {
                        let energy = state.player_energy.get(&p.id).copied().unwrap_or(100.0);
                        MatchPlayer { player: p, energy }
                    })
                    .collect()
            } else {
                best_eleven(&away.squad)
                    .into_iter()
                    .map(|p| MatchPlayer { player: p, energy: 100.0 })
                    .collect()
            };

            let home_lineup_zones = if is_player_home { Some(&lineup_slot_zones) } else { None };
            let away_lineup_zones = if is_player_away { Some(&lineup_slot_zones) } else { None };

            let home_tactics = if is_player_home {
                tactics.clone()
            } else {
                home.coach.as_ref().map(|c| c.derive_tactics()).unwrap_or_default()
            };
            let away_tactics = if is_player_away {
                tactics.clone()
            } else {
                away.coach.as_ref().map(|c| c.derive_tactics()).unwrap_or_default()
            };

            let (home_goals, away_goals, raw_events) =
                simulate_full(home_match_squad, away_match_squad, &home_tactics, &away_tactics, home_lineup_zones, away_lineup_zones);

            update_table(
                &mut player_season.table,
                &home.id,
                &away.id,
                home_goals as i32,
                away_goals as i32,
            );

            let home_name = home.name.clone();
            let away_name = away.name.clone();
            let home_coach_name = if is_player_home {
                state.coach_name.clone()
            } else {
                home.coach.as_ref().map(|c| c.name.clone()).unwrap_or_default()
            };
            let away_coach_name = if is_player_away {
                state.coach_name.clone()
            } else {
                away.coach.as_ref().map(|c| c.name.clone()).unwrap_or_default()
            };
            let events: Vec<MatchEventDto> = raw_events
                .iter()
                .filter_map(|event| {
                    let event_type_str = match &event.event_type {
                        EventType::Goal => "goal",
                        EventType::NearMiss => "nearMiss",
                        EventType::Save => "save",
                        EventType::Foul => "foul",
                        EventType::YellowCard => "yellowCard",
                        EventType::RedCard => "redCard",
                        EventType::Corner => "corner",
                        EventType::Injury => "injury",
                        _ => return None,
                    };
                    let (team_side, team_name) = match &event.team {
                        Some(TeamSide::Home) => ("home", home_name.as_str()),
                        Some(TeamSide::Away) => ("away", away_name.as_str()),
                        None => return None,
                    };
                    Some(MatchEventDto {
                        minute: event.minute as u32,
                        event_type: event_type_str.to_string(),
                        team_side: team_side.to_string(),
                        team_name: team_name.to_string(),
                        player_name: event.player_name.clone(),
                    })
                })
                .collect();

            // Calcular player_energy_after para a partida do jogador
            let match_energy_after = if is_player_home || is_player_away {
                let player_season_ref = &player_season;
                let team = if is_player_home {
                    &player_season_ref.teams[m.home_idx]
                } else {
                    &player_season_ref.teams[m.away_idx]
                };
                team.squad
                    .iter()
                    .map(|p| {
                        let current = state.player_energy.get(&p.id).copied().unwrap_or(100.0);
                        let minutes = if starter_ids.contains(&p.id.to_lowercase()) { Some(90u8) }
                            else if bench_ids.contains(&p.id.to_lowercase()) { Some(0u8) }
                            else { None };
                        let drain = match minutes {
                            Some(m) => energy_drain(p.stamina, &tactics.play_style, m),
                            None => 0.0,
                        };
                        let recovery = energy_recovery(p.stamina, minutes);
                        let new_energy = (current - drain + recovery).clamp(0.0, 100.0);
                        (p.id.clone(), new_energy)
                    })
                    .collect::<HashMap<_, _>>()
            } else {
                HashMap::new()
            };

            // Persistir energia atualizada no CareerState
            for (id, val) in &match_energy_after {
                state.player_energy.insert(id.clone(), *val);
            }

            // Atualizar moral se for a partida do jogador
            if is_player_home || is_player_away {
                let result = if is_player_home {
                    if home_goals > away_goals {
                        MatchResult::Win
                    } else if home_goals < away_goals {
                        MatchResult::Loss
                    } else {
                        MatchResult::Draw
                    }
                } else {
                    // is_player_away
                    if away_goals > home_goals {
                        MatchResult::Win
                    } else if away_goals < home_goals {
                        MatchResult::Loss
                    } else {
                        MatchResult::Draw
                    }
                };

                // Obter posição atual do jogador na tabela
                let sorted_standings = sorted_table_rows(&player_season);
                let player_position = sorted_standings
                    .iter()
                    .position(|entry| entry.team_id.eq_ignore_ascii_case(&state.player_team_id))
                    .map(|pos| (pos + 1) as u32)
                    .unwrap_or(20);

                let (new_morale, new_streak) = calculate_morale_change(
                    state.morale,
                    state.result_streak,
                    result,
                    player_position,
                    player_season.current_round as u32,
                );

                state.morale = new_morale;
                state.result_streak = new_streak;
            }

            player_results.push(RoundMatchDto {
                home_team_id: home.id.clone(),
                home_team_name: home_name,
                home_coach_name,
                home_goals: home_goals as i32,
                away_team_id: away.id.clone(),
                away_team_name: away_name,
                away_coach_name,
                away_goals: away_goals as i32,
                events,
                player_energy_after: match_energy_after,
            });
        }

        player_season.current_round += 1;

        // Verificar se a temporada terminou e aplicar bônus de título
        if player_season.current_round >= player_season.schedule.len() {
            let final_standings = sorted_table_rows(&player_season);
            if let Some(champion_pos) = final_standings
                .iter()
                .position(|entry| entry.team_id.eq_ignore_ascii_case(&state.player_team_id))
            {
                match champion_pos {
                    0 => {
                        // Campeão: +50%
                        state.morale = (state.morale + 50).min(100);
                        state.result_streak = 0; // Reset streak após título
                    }
                    1 => {
                        // Vice-campeão: +30%
                        state.morale = (state.morale + 30).min(100);
                        state.result_streak = 0;
                    }
                    _ => {}
                }
            }
        }

        (player_results, played_round)
    };

    let mut background_results = Vec::new();

    let other_leagues: Vec<String> = state
        .active_league_ids
        .iter()
        .filter(|league_id| !league_id.eq_ignore_ascii_case(&state.player_league_id))
        .cloned()
        .collect();

    for league_id in other_leagues {
        if let Some(season) = state.seasons.get_mut(&league_id) {
            if season.current_round >= season.schedule.len() {
                continue;
            }

            let round_matches = season.schedule[season.current_round].clone();
            let mut bg_matches: Vec<BackgroundMatchDto> = Vec::with_capacity(round_matches.len());

            for m in &round_matches {
                let home = &season.teams[m.home_idx];
                let away = &season.teams[m.away_idx];

                let (home_goals, away_goals, goal_events) =
                    simulate_silent(
                        best_eleven(&home.squad),
                        best_eleven(&away.squad),
                        home.coach.as_ref().map(|c| c.derive_tactics()).unwrap_or_default(),
                        away.coach.as_ref().map(|c| c.derive_tactics()).unwrap_or_default(),
                    );

                update_table(
                    &mut season.table,
                    &home.id,
                    &away.id,
                    home_goals as i32,
                    away_goals as i32,
                );

                let home_name = home.name.clone();
                let away_name = away.name.clone();

                bg_matches.push(BackgroundMatchDto {
                    home_team_name: home_name.clone(),
                    away_team_name: away_name.clone(),
                    home_goals: home_goals as i32,
                    away_goals: away_goals as i32,
                    goal_events: {
                        let mut home_g = 0i32;
                        let mut away_g = 0i32;
                        goal_events
                            .iter()
                            .map(|(minute, side)| {
                                match side {
                                    TeamSide::Home => home_g += 1,
                                    TeamSide::Away => away_g += 1,
                                }
                                BackgroundGoalEventDto {
                                    minute: *minute as u32,
                                    home_team_name: home_name.clone(),
                                    away_team_name: away_name.clone(),
                                    home_goals: home_g,
                                    away_goals: away_g,
                                }
                            })
                            .collect()
                    },
                });
            }

            season.current_round += 1;
            let leader = season_leader(season);

            background_results.push(BackgroundLeagueRoundDto {
                league_id: season.league_id.clone(),
                played_round: season.current_round as u32,
                leader_team_name: leader.0,
                leader_points: leader.1,
                matches: bg_matches,
            });
        }
    }

    background_results.sort_by(|a, b| a.league_id.cmp(&b.league_id));

    // Verificar chance de demissão baseada na moral
    let dismissal_chance = calculate_dismissal_chance(state.morale);
    let dismissed = if dismissal_chance > 0.0 {
        let roll = rand::thread_rng().gen::<f64>();
        roll < dismissal_chance
    } else {
        false
    };

    Ok(SimulateRoundResultDto {
        played_round: played_round as u32,
        matches: player_results,
        background_leagues: background_results,
        snapshot: snapshot(state, all_leagues),
        player_energy_after: state.player_energy.clone(),
        dismissed,
    })
}

fn build_league_season(league: &League) -> Result<LeagueSeasonState, String> {
    let mut teams: Vec<TeamMeta> = league
        .teams
        .iter()
        .map(|team| TeamMeta {
            id: team.id.clone(),
            name: team.name.clone(),
            stadium: team.stadium.clone(),
            squad: team.squad.clone(),
            coach: team.coach.clone(),
            budget: Some(team.budget),
        })
        .collect();

    teams.sort_by(|a, b| a.name.cmp(&b.name));

    if teams.len() < 2 {
        return Err(format!(
            "Liga '{}' precisa ter pelo menos dois times",
            league.id
        ));
    }

    let schedule = generate_schedule(teams.len());

    let mut table = HashMap::new();
    for team in &teams {
        table.insert(team.id.clone(), Standing::default());
    }

    Ok(LeagueSeasonState {
        league_id: league.id.clone(),
        current_round: 0,
        teams,
        schedule,
        table,
    })
}

fn sorted_table_rows(season: &LeagueSeasonState) -> Vec<TableEntryDto> {
    let mut table_rows: Vec<TableEntryDto> = season
        .teams
        .iter()
        .filter_map(|team| {
            season.table.get(&team.id).map(|standing| TableEntryDto {
                team_id: team.id.clone(),
                team_name: team.name.clone(),
                played: standing.played,
                wins: standing.wins,
                draws: standing.draws,
                losses: standing.losses,
                goals_for: standing.goals_for,
                goals_against: standing.goals_against,
                goal_diff: standing.goals_for - standing.goals_against,
                points: standing.points,
            })
        })
        .collect();

    table_rows.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then((b.goal_diff).cmp(&a.goal_diff))
            .then(b.goals_for.cmp(&a.goals_for))
            .then(a.team_name.cmp(&b.team_name))
    });

    table_rows
}

fn season_leader(season: &LeagueSeasonState) -> (String, u32) {
    let table = sorted_table_rows(season);
    if let Some(first) = table.first() {
        (first.team_name.clone(), first.points)
    } else {
        ("-".to_string(), 0)
    }
}

fn update_table(
    table: &mut HashMap<String, Standing>,
    home_id: &str,
    away_id: &str,
    home_goals: i32,
    away_goals: i32,
) {
    if let Some(home) = table.get_mut(home_id) {
        home.played += 1;
        home.goals_for += home_goals;
        home.goals_against += away_goals;
        if home_goals > away_goals {
            home.wins += 1;
            home.points += 3;
        } else if home_goals == away_goals {
            home.draws += 1;
            home.points += 1;
        } else {
            home.losses += 1;
        }
    }

    if let Some(away) = table.get_mut(away_id) {
        away.played += 1;
        away.goals_for += away_goals;
        away.goals_against += home_goals;
        if away_goals > home_goals {
            away.wins += 1;
            away.points += 3;
        } else if away_goals == home_goals {
            away.draws += 1;
            away.points += 1;
        } else {
            away.losses += 1;
        }
    }
}

fn generate_schedule(team_count: usize) -> Vec<Vec<ScheduledMatch>> {
    let mut participants: Vec<Option<usize>> = (0..team_count).map(Some).collect();
    if participants.len() % 2 == 1 {
        participants.push(None);
    }

    let rounds = participants.len() - 1;
    let half = participants.len() / 2;
    let mut first_leg: Vec<Vec<ScheduledMatch>> = Vec::with_capacity(rounds);

    for round in 0..rounds {
        let mut games = Vec::new();
        for i in 0..half {
            let a = participants[i];
            let b = participants[participants.len() - 1 - i];
            if let (Some(t1), Some(t2)) = (a, b) {
                if round % 2 == 0 {
                    games.push(ScheduledMatch {
                        home_idx: t1,
                        away_idx: t2,
                    });
                } else {
                    games.push(ScheduledMatch {
                        home_idx: t2,
                        away_idx: t1,
                    });
                }
            }
        }

        first_leg.push(games);

        if let Some(last) = participants.pop() {
            participants.insert(1, last);
        }
    }

    let mut second_leg: Vec<Vec<ScheduledMatch>> = first_leg
        .iter()
        .map(|games| {
            games
                .iter()
                .map(|m| ScheduledMatch {
                    home_idx: m.away_idx,
                    away_idx: m.home_idx,
                })
                .collect()
        })
        .collect();

    first_leg.append(&mut second_leg);
    first_leg
}

// ══════════════════════════════════════════════════════════════════════════════
// Transferência de Técnicos
// ══════════════════════════════════════════════════════════════════════════════

/// Struct para representar uma oferta de clube para o técnico
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubOfferDto {
    pub team_id: String,
    pub team_name: String,
    pub league_id: String,
    pub current_position: u32,
    pub morale: i32,
}

/// Lista clubes disponíveis para o técnico demitido.
/// Retorna clubes de todas as ligas que estão em situação difícil (moral baixa, posição ruim).
pub fn list_available_clubs(
    state: &CareerState,
    all_leagues: &HashMap<String, League>,
) -> Vec<ClubOfferDto> {
    let mut offers: Vec<ClubOfferDto> = Vec::new();

    for league_id in &state.active_league_ids {
        if let Some(season) = state.seasons.get(league_id) {
            let league = all_leagues.get(league_id);
            if league.is_none() {
                continue;
            }

            let table = sorted_table_rows(season);
            let total_teams = table.len() as u32;

            // Apenas oferecer clubes no bottom 40% da tabela (zona de rebaixamento + próximos)
            // Exemplo: campeonato com 20 times → oferecer apenas do 13º em diante
            let min_position = ((total_teams as f32 * 0.6).ceil() as u32).max(1);

            for (idx, entry) in table.iter().enumerate() {
                let position = (idx + 1) as u32;

                // Não oferecer o próprio time do jogador
                if entry.team_id.eq_ignore_ascii_case(&state.player_team_id) {
                    continue;
                }

                // Apenas times na metade inferior da tabela podem oferecer vaga
                if position < min_position {
                    continue;
                }

                // Simular moral baseada na posição:
                // - Últimos 4 colocados: moral 10-25% (situação crítica)
                // - Zona intermediária de perigo: moral 25-45% (situação difícil)
                let relegation_zone = total_teams.saturating_sub(3);
                let simulated_morale = if position > relegation_zone {
                    // Zona de rebaixamento direta: moral muito baixa
                    rand::thread_rng().gen_range(10..=25)
                } else {
                    // Próximo da zona: moral baixa/média
                    rand::thread_rng().gen_range(25..=45)
                };

                offers.push(ClubOfferDto {
                    team_id: entry.team_id.clone(),
                    team_name: entry.team_name.clone(),
                    league_id: league_id.clone(),
                    current_position: position,
                    morale: simulated_morale,
                });

                // Limitar a 5 ofertas no máximo
                if offers.len() >= 5 {
                    break;
                }
            }
        }
    }

    // Ordenar por posição (pior primeiro - maiores chances de rebaixamento no topo)
    offers.sort_by(|a, b| b.current_position.cmp(&a.current_position));

    offers
}

/// Transfere o técnico do jogador para outro time.
/// Reseta a moral para um valor inicial e atualiza o time do jogador.
pub fn transfer_coach_to_team(
    state: &mut CareerState,
    new_team_id: &str,
    all_leagues: &HashMap<String, League>,
) -> Result<CareerSnapshotDto, String> {
    // Encontrar em qual liga está o novo time
    let mut found_league_id: Option<String> = None;

    for (league_id, season) in &state.seasons {
        if season.teams.iter().any(|t| t.id.eq_ignore_ascii_case(new_team_id)) {
            found_league_id = Some(league_id.clone());
            break;
        }
    }

    let new_league_id = found_league_id.ok_or_else(|| {
        format!("Time {} não encontrado em nenhuma liga ativa", new_team_id)
    })?;

    // Atualizar o estado
    state.player_team_id = new_team_id.to_string();
    state.player_league_id = new_league_id;
    state.morale = 60; // Moral inicial moderada no novo clube
    state.result_streak = 0;

    // Recalcular energia dos jogadores do novo time
    state.player_energy.clear();
    if let Some(season) = state.seasons.get(&state.player_league_id) {
        if let Some(team_meta) = season.teams.iter().find(|t| t.id.eq_ignore_ascii_case(new_team_id)) {
            for player in &team_meta.squad {
                state.player_energy.insert(player.id.clone(), 100.0);
            }
        }
    }

    Ok(snapshot(state, all_leagues))
}

