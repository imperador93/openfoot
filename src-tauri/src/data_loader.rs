// src-tauri/src/data_loader.rs
//
// Equivalente ao DataFactory.cs + GameData.cs do FutSimulatorOS.
// Lê leagues.json, teams.json e players.json e monta o grafo completo
// League → Teams → Players em memória.

use std::collections::HashMap;
use anyhow::{Context, Result};

use crate::models::{League, Player, Team};
use crate::models::league::{LeaguesFile, LeagueRecord};
use crate::models::team::{TeamsFile, TeamRecord};

const LEAGUES_FILE: &str = "resources/data/leagues.json";
const TEAMS_FILE: &str = "resources/data/teams.json";
const PLAYERS_FILE: &str = "resources/data/players.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PlayersFile {
    players: Vec<Player>,
}

use serde::Deserialize;

/// Carrega tudo e retorna um mapa league_id → League completa (com teams e squads).
/// Equivale a DataFactory.LoadAllLeagues() do C#.
pub fn load_all_leagues() -> Result<HashMap<String, League>> {
    let leagues_raw = load_leagues_file()?;
    let teams_raw = load_teams_file()?;
    let players_raw = load_players_file()?;

    // Índice players por team_id
    let mut players_by_team: HashMap<String, Vec<Player>> = HashMap::new();
    for p in players_raw {
        players_by_team.entry(p.team_id.clone()).or_default().push(p);
    }

    // Índice teams por id
    let mut teams_by_id: HashMap<String, TeamRecord> = HashMap::new();
    for t in teams_raw {
        teams_by_id.insert(t.id.clone(), t);
    }

    // Monta League → Teams → Players
    let mut result: HashMap<String, League> = HashMap::new();
    for lr in leagues_raw {
        let teams: Vec<Team> = lr
            .team_ids
            .iter()
            .filter_map(|tid| {
                let rec = teams_by_id.get(tid)?;
                let mut squad = players_by_team.remove(tid).unwrap_or_default();
                // Pré-seleciona os 11 melhores como Titular,
                // igual ao LoadRosterForSelection() do MainForm.cs
                presort_squad(&mut squad);
                
                // Calcular orçamento inicial
                let budget = Team::calculate_initial_budget(lr.tier, rec.tier);
                
                Some(Team {
                    id: rec.id.clone(),
                    name: rec.name.clone(),
                    stadium: rec.stadium.clone(),
                    league_id: lr.id.clone(),
                    tier: rec.tier,
                    budget,
                    coach: rec.coach.clone(),
                    squad,
                })
            })
            .collect();

        result.insert(
            lr.id.clone(),
            League {
                id: lr.id.clone(),
                name: lr.name.clone(),
                country: lr.country.clone(),
                tier: lr.tier,
                division_level: lr.division_level,
                lower_division_id: lr.lower_division_id.clone(),
                upper_division_id: lr.upper_division_id.clone(),
                teams,
            },
        );
    }

    Ok(result)
}

/// Retorna uma liga específica pelo id.
/// Equivale a DataFactory.LoadLeagueForPlay(leagueId) do C#.
pub fn load_league_for_play(league_id: &str) -> Result<League> {
    let mut all = load_all_leagues()?;
    all.remove(league_id)
        .with_context(|| format!("Liga '{}' não encontrada", league_id))
}

// ── helpers internos ────────────────────────────────────────────────────────

pub fn load_leagues_file() -> Result<Vec<LeagueRecord>> {
    let path = asset_path(LEAGUES_FILE);
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("Não foi possível ler {}", path))?;
    let parsed: LeaguesFile = serde_json::from_str(&raw)
        .with_context(|| format!("JSON inválido em {}", path))?;
    Ok(parsed.leagues)
}

pub fn load_teams_file() -> Result<Vec<TeamRecord>> {
    let path = asset_path(TEAMS_FILE);
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("Não foi possível ler {}", path))?;
    let parsed: TeamsFile = serde_json::from_str(&raw)
        .with_context(|| format!("JSON inválido em {}", path))?;
    Ok(parsed.teams)
}

pub fn load_players_file() -> Result<Vec<Player>> {
    let path = asset_path(PLAYERS_FILE);
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("Não foi possível ler {}", path))?;
    
    // Tentar fazer parse e capturar erro detalhado do serde
    let parsed: PlayersFile = serde_json::from_str(&raw)
        .map_err(|e| {
            eprintln!("❌ Erro de deserialização em {}:", path);
            eprintln!("   Linha: {}, Coluna: {}", e.line(), e.column());
            eprintln!("   Mensagem: {}", e);
            e
        })
        .with_context(|| format!("JSON inválido em {}", path))?;
    Ok(parsed.players)
}

/// Pré-seleciona os 11 melhores jogadores do elenco como Titular.
/// Lógica idêntica ao LoadRosterForSelection() do MainForm.cs.
fn presort_squad(squad: &mut Vec<Player>) {
    use crate::models::player::PlayerStatus;

    // Ordena por overall desc para identificar os top 11
    let mut indexed: Vec<(usize, u8)> = squad
        .iter()
        .enumerate()
        .map(|(i, p)| (i, p.overall()))
        .collect();
    indexed.sort_unstable_by(|a, b| b.1.cmp(&a.1));

    for (rank, (idx, _)) in indexed.iter().enumerate() {
        squad[*idx].status = if rank < 11 {
            PlayerStatus::Titular
        } else {
            PlayerStatus::Reserva
        };
    }

    // Re-ordena por posição (GK → DEF → MID → ATK), depois overall desc
    squad.sort_by(|a, b| {
        a.position
            .display_rank()
            .cmp(&b.position.display_rank())
            .then(b.overall().cmp(&a.overall()))
    });
}

/// Resolve o caminho do asset relativo à pasta do executável.
/// Em dev (tauri dev) o CWD é a raiz do projeto; em produção fica junto ao .exe.
fn asset_path(relative: &str) -> String {
    // Tauri v2 expõe app.path().resource_dir() em runtime,
    // mas no data_loader (chamado de commands) usamos std::env::current_dir
    // como fallback simples para desenvolvimento.
    let base = std::env::current_dir().unwrap_or_default();
    base.join(relative).to_string_lossy().into_owned()
}

// ── testes ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_serie_a() {
        let league = load_league_for_play("bra-serie-a")
            .expect("deve carregar Brasileirão Série A");
        assert_eq!(league.id, "bra-serie-a");
        assert!(!league.teams.is_empty(), "deve ter times");
        for team in &league.teams {
            assert!(!team.squad.is_empty(), "time {} sem jogadores", team.name);
        }
    }

    #[test]
    fn test_starters_count() {
        let league = load_league_for_play("bra-serie-a").unwrap();
        for team in &league.teams {
            let starters = team.starters();
            assert!(
                starters.len() <= 11,
                "time {} tem mais de 11 titulares",
                team.name
            );
        }
    }

    #[test]
    fn test_overall_range() {
        let league = load_league_for_play("bra-serie-a").unwrap();
        for team in &league.teams {
            for player in &team.squad {
                let ovr = player.overall();
                assert!(ovr >= 30 && ovr <= 99, "overall fora do range: {}", ovr);
            }
        }
    }
}