use crate::engine::match_engine::{simulate_full, simulate_silent, EventType, TeamSide};
use crate::models::{League, Player};
use crate::models::lineup::SavedLineup;
use crate::models::tactics::Tactics;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct TeamMeta {
    id: String,
    name: String,
    stadium: String,
    squad: Vec<Player>,
}

#[derive(Debug, Clone)]
struct ScheduledMatch {
    home_idx: usize,
    away_idx: usize,
}

#[derive(Debug, Clone, Default)]
struct Standing {
    played: u32,
    wins: u32,
    draws: u32,
    losses: u32,
    goals_for: i32,
    goals_against: i32,
    points: u32,
}

#[derive(Debug, Clone)]
struct LeagueSeasonState {
    league_id: String,
    current_round: usize,
    teams: Vec<TeamMeta>,
    schedule: Vec<Vec<ScheduledMatch>>,
    table: HashMap<String, Standing>,
}

#[derive(Debug, Clone)]
pub struct CareerState {
    player_team_id: String,
    player_league_id: String,
    active_league_ids: Vec<String>,
    seasons: HashMap<String, LeagueSeasonState>,
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
    away_team_id: String,
    away_team_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchEventDto {
    minute: u32,
    event_type: String, // "goal" | "shot" | "dangerous"
    team_side: String,  // "home" | "away"
    team_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundMatchDto {
    home_team_id: String,
    home_team_name: String,
    home_goals: i32,
    away_team_id: String,
    away_team_name: String,
    away_goals: i32,
    events: Vec<MatchEventDto>,
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
    active_league_ids: Vec<String>,
    current_round: u32,
    total_rounds: u32,
    player_position: u32,
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
}

pub fn start_career(league: &League, player_team_id: &str) -> Result<CareerState, String> {
    let mut league_map = HashMap::new();
    league_map.insert(league.id.clone(), league.clone());
    start_career_multi(
        &league_map,
        &league.id,
        player_team_id,
        std::slice::from_ref(&league.id),
    )
}

pub fn start_career_multi(
    leagues: &HashMap<String, League>,
    player_league_id: &str,
    player_team_id: &str,
    active_league_ids: &[String],
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

    let mut seasons = HashMap::new();

    for league_id in &dedup_active {
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

    Ok(CareerState {
        player_team_id: player_team_id.to_string(),
        player_league_id: player_league_id.to_string(),
        active_league_ids: dedup_active,
        seasons,
    })
}

pub fn snapshot(state: &CareerState) -> CareerSnapshotDto {
    let player_season = state
        .seasons
        .get(&state.player_league_id)
        .expect("player league season must exist");

    let table_rows = sorted_table_rows(player_season);

    let next_round_fixtures = player_season
        .schedule
        .get(player_season.current_round)
        .map(|matches| {
            matches
                .iter()
                .map(|m| FixtureDto {
                    home_team_id: player_season.teams[m.home_idx].id.clone(),
                    home_team_name: player_season.teams[m.home_idx].name.clone(),
                    home_stadium: player_season.teams[m.home_idx].stadium.clone(),
                    away_team_id: player_season.teams[m.away_idx].id.clone(),
                    away_team_name: player_season.teams[m.away_idx].name.clone(),
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

    // Data gerada - temporada comeca em 10/08, +7 dias por rodada
    let season_start = chrono::NaiveDate::from_ymd_opt(2025, 8, 10).unwrap();
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

    CareerSnapshotDto {
        league_id: state.player_league_id.clone(),
        player_team_id: state.player_team_id.clone(),
        active_league_ids: state.active_league_ids.clone(),
        current_round: player_season.current_round as u32,
        total_rounds: player_season.schedule.len() as u32,
        player_position,
        next_match_date,
        table: table_rows,
        next_round_fixtures,
        background_leagues,
    }
}

fn best_eleven(squad: &[Player]) -> Vec<Player> {
    let mut sorted = squad.to_vec();
    sorted.sort_by(|a, b| b.overall().cmp(&a.overall()));
    sorted.truncate(11);
    sorted
}

fn squad_for_match(squad: &[Player], lineup: &SavedLineup) -> Vec<Player> {
    let lineup_ids = lineup.starter_ids();
    if lineup_ids.len() >= 11 {
        let filtered: Vec<Player> = squad
            .iter()
            .filter(|p| lineup_ids.iter().any(|id| id.eq_ignore_ascii_case(&p.id)))
            .cloned()
            .collect();
        if filtered.len() >= 11 {
            return filtered;
        }
    }
    best_eleven(squad)
}

pub fn simulate_next_round(
    state: &mut CareerState,
    lineup: &SavedLineup,
    tactics: Tactics,
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

        for m in &round_matches {
            let home = &player_season.teams[m.home_idx];
            let away = &player_season.teams[m.away_idx];

            let home_squad = if home.id.eq_ignore_ascii_case(&player_team_id) {
                squad_for_match(&home.squad, lineup)
            } else {
                best_eleven(&home.squad)
            };
            let away_squad = if away.id.eq_ignore_ascii_case(&player_team_id) {
                squad_for_match(&away.squad, lineup)
            } else {
                best_eleven(&away.squad)
            };

            let home_lineup_zones = if home.id.eq_ignore_ascii_case(&player_team_id) {
                Some(&lineup_slot_zones)
            } else {
                None
            };
            let away_lineup_zones = if away.id.eq_ignore_ascii_case(&player_team_id) {
                Some(&lineup_slot_zones)
            } else {
                None
            };

            let (home_goals, away_goals, raw_events) =
                simulate_full(home_squad, away_squad, &tactics, home_lineup_zones, away_lineup_zones);

            update_table(
                &mut player_season.table,
                &home.id,
                &away.id,
                home_goals as i32,
                away_goals as i32,
            );

            let home_name = home.name.clone();
            let away_name = away.name.clone();
            let events: Vec<MatchEventDto> = raw_events
                .iter()
                .filter_map(|event| {
                    let event_type_str = match &event.event_type {
                        EventType::Goal => "goal",
                        EventType::NearMiss => "shot",
                        EventType::Save => "dangerous",
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
                    })
                })
                .collect();

            player_results.push(RoundMatchDto {
                home_team_id: home.id.clone(),
                home_team_name: home_name,
                home_goals: home_goals as i32,
                away_team_id: away.id.clone(),
                away_team_name: away_name,
                away_goals: away_goals as i32,
                events,
            });
        }

        player_season.current_round += 1;
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
                    simulate_silent(best_eleven(&home.squad), best_eleven(&away.squad));

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

    Ok(SimulateRoundResultDto {
        played_round: played_round as u32,
        matches: player_results,
        background_leagues: background_results,
        snapshot: snapshot(state),
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
