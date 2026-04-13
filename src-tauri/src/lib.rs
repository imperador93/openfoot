// src-tauri/src/lib.rs

mod models;
mod data_loader;
mod game_engine;
mod engine;

use data_loader::load_all_leagues;
use game_engine::{
    start_career,
    start_career_multi,
    snapshot,
    simulate_next_round,
    CareerSnapshotDto,
    CareerState,
    SimulateRoundResultDto,
};
use models::{League, SavedLineup, SlotZone, Tactics};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub leagues: Mutex<Option<HashMap<String, League>>>,
    pub career: Mutex<Option<CareerState>>,
    pub lineup: Mutex<Option<SavedLineup>>,
}

fn ensure_leagues_loaded(cache: &mut Option<HashMap<String, League>>) -> Result<(), String> {
    if cache.is_none() {
        *cache = Some(load_all_leagues().map_err(|e| e.to_string())?);
    }
    Ok(())
}

#[tauri::command]
fn fetch_leagues(state: State<AppState>) -> Result<Vec<League>, String> {
    let mut cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut cache)?;
    Ok(cache.as_ref().unwrap().values().cloned().collect())
}

#[tauri::command]
fn fetch_league(id: String, state: State<AppState>) -> Result<League, String> {
    let mut cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut cache)?;
    cache
        .as_ref()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("Liga '{}' não encontrada", id))
}

#[tauri::command]
fn start_new_career(
    league_id: String,
    team_id: String,
    state: State<AppState>,
) -> Result<CareerSnapshotDto, String> {
    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let league = leagues_cache
        .as_ref()
        .and_then(|all| all.get(&league_id))
        .cloned()
        .ok_or_else(|| format!("Liga '{}' não encontrada", league_id))?;

    let career = start_career(&league, &team_id)?;
    let snapshot = snapshot(&career);

    let mut career_guard = state.career.lock().unwrap();
    *career_guard = Some(career);

    Ok(snapshot)
}

#[tauri::command]
fn start_new_career_multi(
    league_id: String,
    team_id: String,
    active_league_ids: Vec<String>,
    state: State<AppState>,
) -> Result<CareerSnapshotDto, String> {
    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let all_leagues = leagues_cache
        .as_ref()
        .ok_or_else(|| "Falha ao carregar ligas".to_string())?;

    let career = start_career_multi(all_leagues, &league_id, &team_id, &active_league_ids)?;
    let snapshot = snapshot(&career);

    let mut career_guard = state.career.lock().unwrap();
    *career_guard = Some(career);

    Ok(snapshot)
}

#[tauri::command]
fn simulate_career_round(
    formation: String,
    play_style: String,
    state: State<AppState>,
) -> Result<SimulateRoundResultDto, String> {
    let tactics: Tactics = serde_json::from_str(&format!(
        r#"{{"formation":"{}","playStyle":"{}"}}"#,
        formation, play_style
    ))
    .map_err(|e| format!("Tatica invalida: {}", e))?;

    let lineup = state
        .lineup
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "Nenhuma escalacao salva. Monte o elenco e salve novamente.".to_string())?;
    if lineup.starters.len() < 7 {
        return Err(
            "Minimo de 7 jogadores para simular. Escale pelo menos 7 no menu Escalacao."
                .to_string(),
        );
    }

    let mut career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_mut()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    simulate_next_round(career, &lineup, tactics)
}

#[tauri::command]
fn get_career_snapshot(state: State<AppState>) -> Result<CareerSnapshotDto, String> {
    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    Ok(snapshot(career))
}

#[tauri::command]
fn save_lineup(lineup: SavedLineup, state: State<AppState>) -> Result<(), String> {
    if lineup.starters.len() > 11 {
        return Err("Escalacao invalida: maximo de 11 titulares".to_string());
    }
    if lineup.starters.len() < 7 {
        return Err("Escalacao invalida: minimo de 7 titulares".to_string());
    }
    if lineup.bench.len() > 7 {
        return Err("Escalacao invalida: maximo de 7 reservas".to_string());
    }
    if lineup.starters.len() + lineup.bench.len() > 18 {
        return Err("Escalacao invalida: maximo de 18 jogadores (11 titulares + 7 reservas)".to_string());
    }

    if !lineup
        .starters
        .iter()
        .any(|slot| matches!(slot.slot_zone, SlotZone::Gol))
    {
        return Err("Escalacao invalida: slot de goleiro precisa estar preenchido".to_string());
    }

    let mut unique_players = std::collections::HashSet::new();
    let mut used_slot_indexes = std::collections::HashSet::new();
    for slot in &lineup.starters {
        if slot.player_id.trim().is_empty() {
            return Err("Escalacao invalida: titular com playerId vazio".to_string());
        }
        if usize::from(slot.slot_index) >= 11 {
            return Err("Escalacao invalida: slotIndex de titular fora do intervalo".to_string());
        }
        if !used_slot_indexes.insert(slot.slot_index) {
            return Err("Escalacao invalida: slotIndex de titular duplicado".to_string());
        }
        if !unique_players.insert(slot.player_id.to_lowercase()) {
            return Err("Escalacao invalida: jogador duplicado entre titulares/reservas".to_string());
        }
    }
    for bench_id in &lineup.bench {
        if bench_id.trim().is_empty() {
            return Err("Escalacao invalida: reserva com playerId vazio".to_string());
        }
        if !unique_players.insert(bench_id.to_lowercase()) {
            return Err("Escalacao invalida: jogador duplicado entre titulares/reservas".to_string());
        }
    }

    let mut lineup_guard = state.lineup.lock().unwrap();
    *lineup_guard = Some(lineup);
    Ok(())
}

#[tauri::command]
fn get_lineup(state: State<AppState>) -> Result<SavedLineup, String> {
    let lineup = state.lineup.lock().unwrap();
    Ok(lineup.clone().unwrap_or_default())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            leagues: Mutex::new(None),
            career: Mutex::new(None),
            lineup: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            fetch_leagues,
            fetch_league,
            start_new_career,
            start_new_career_multi,
            simulate_career_round,
            get_career_snapshot,
            save_lineup,
            get_lineup,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o app");
}