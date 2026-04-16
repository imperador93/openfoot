// src-tauri/src/lib.rs

mod models;
mod data_loader;
mod game_engine;
mod engine;

use data_loader::load_all_leagues;
use game_engine::{
    start_career,
    start_career_multi,
    start_new_season,
    snapshot,
    simulate_next_round,
    list_available_clubs,
    transfer_coach_to_team,
    CalendarDataDto,
    CareerSnapshotDto,
    CareerState,
    ClubOfferDto,
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
fn test_json_loading() -> Result<String, String> {
    use data_loader::{load_leagues_file, load_teams_file, load_players_file};
    
    let mut report = String::new();
    
    // Testar leagues
    match load_leagues_file() {
        Ok(leagues) => {
            report.push_str(&format!("✅ leagues.json: {} ligas\n", leagues.len()));
        }
        Err(e) => {
            return Err(format!("❌ leagues.json: {}", e));
        }
    }
    
    // Testar teams
    match load_teams_file() {
        Ok(teams) => {
            report.push_str(&format!("✅ teams.json: {} times\n", teams.len()));
        }
        Err(e) => {
            return Err(format!("❌ teams.json: {}", e));
        }
    }
    
    // Testar players
    match load_players_file() {
        Ok(players) => {
            report.push_str(&format!("✅ players.json: {} jogadores\n", players.len()));
            let with_accents = players.iter()
                .filter(|p| p.name.contains('ã') || p.name.contains('ç') || p.name.contains('é'))
                .count();
            report.push_str(&format!("   {} jogadores com acentos corretos", with_accents));
        }
        Err(e) => {
            return Err(format!("❌ players.json: {}", e));
        }
    }
    
    Ok(report)
}

#[tauri::command]
fn debug_paths() -> Result<String, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| e.to_string())?;
    let leagues_path = cwd.join("resources/data/leagues.json");
    let exists = leagues_path.exists();
    Ok(format!(
        "CWD: {}\nLeagues path: {}\nExists: {}",
        cwd.display(),
        leagues_path.display(),
        exists
    ))
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
    // Limpar escalação ao iniciar nova carreira
    {
        let mut lineup_guard = state.lineup.lock().unwrap();
        *lineup_guard = None;
    }

    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let all_leagues = leagues_cache.as_ref().unwrap();
    
    let league = all_leagues
        .get(&league_id)
        .cloned()
        .ok_or_else(|| format!("Liga '{}' não encontrada", league_id))?;

    let career = start_career(&league, &team_id)?;
    let snapshot = snapshot(&career, all_leagues);

    let mut career_guard = state.career.lock().unwrap();
    *career_guard = Some(career);

    Ok(snapshot)
}

#[tauri::command]
fn start_new_career_multi(
    league_id: String,
    team_id: String,
    coach_name: String,
    active_league_ids: Vec<String>,
    state: State<AppState>,
) -> Result<CareerSnapshotDto, String> {
    // Limpar escalação ao iniciar nova carreira
    {
        let mut lineup_guard = state.lineup.lock().unwrap();
        *lineup_guard = None;
    }

    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let all_leagues = leagues_cache
        .as_ref()
        .ok_or_else(|| "Falha ao carregar ligas".to_string())?;

    let career = start_career_multi(all_leagues, &league_id, &team_id, &active_league_ids, &coach_name)?;
    let snapshot = snapshot(&career, all_leagues);

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

    let mut leagues_guard = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_guard)?;
    let all_leagues = leagues_guard.as_ref().unwrap();

    simulate_next_round(career, &lineup, tactics, all_leagues)
}

#[tauri::command]
fn get_career_snapshot(state: State<AppState>) -> Result<CareerSnapshotDto, String> {
    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    let mut leagues_guard = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_guard)?;
    let all_leagues = leagues_guard.as_ref().unwrap();

    Ok(snapshot(career, all_leagues))
}

#[tauri::command]
fn get_calendar_data(state: State<AppState>) -> Result<CalendarDataDto, String> {
    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    game_engine::get_calendar_data(career)
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
fn get_player_energies(state: State<AppState>) -> Result<HashMap<String, f64>, String> {
    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;
    Ok(career.player_energy.clone())
}

#[tauri::command]
fn get_lineup(state: State<AppState>) -> Result<SavedLineup, String> {
    let lineup = state.lineup.lock().unwrap();
    Ok(lineup.clone().unwrap_or_default())
}

#[tauri::command]
fn advance_to_next_season(state: State<AppState>) -> Result<CareerSnapshotDto, String> {
    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let all_leagues = leagues_cache
        .as_ref()
        .ok_or_else(|| "Falha ao carregar ligas".to_string())?;

    let mut career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_mut()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    start_new_season(career, all_leagues)
}

// ============================================================
// Sistema de Transferências de Técnico
// ============================================================

#[tauri::command]
fn list_coach_job_offers(state: State<AppState>) -> Result<Vec<ClubOfferDto>, String> {
    let mut leagues_cache = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_cache)?;

    let all_leagues = leagues_cache
        .as_ref()
        .ok_or_else(|| "Falha ao carregar ligas".to_string())?;

    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    Ok(list_available_clubs(career, all_leagues))
}

#[tauri::command]
fn accept_coach_job_offer(
    new_team_id: String,
    state: State<AppState>,
) -> Result<CareerSnapshotDto, String> {
    // Limpar a escalação salva do time anterior
    {
        let mut lineup_guard = state.lineup.lock().unwrap();
        *lineup_guard = None;
    }

    let mut career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_mut()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    let mut leagues_guard = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_guard)?;
    let all_leagues = leagues_guard.as_ref().unwrap();

    transfer_coach_to_team(career, &new_team_id, all_leagues)
}

// ============================================================
// Sistema de Save Game
// ============================================================

use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize, serde::Deserialize)]
struct SaveMetadata {
    name: String,
    coach_name: String,
    team_name: String,
    league_id: String,
    current_round: usize,
    morale: i32,
    timestamp: u64,
}

fn get_saves_dir() -> Result<PathBuf, String> {
    let app_data = std::env::current_exe()
        .map_err(|e| format!("Erro ao obter diretório: {}", e))?
        .parent()
        .ok_or("Diretório pai não encontrado")?
        .to_path_buf();
    
    let saves_dir = app_data.join("saves");
    if !saves_dir.exists() {
        fs::create_dir_all(&saves_dir)
            .map_err(|e| format!("Erro ao criar diretório de saves: {}", e))?;
    }
    Ok(saves_dir)
}

#[tauri::command]
fn save_career(
    save_name: String,
    state: State<AppState>,
) -> Result<String, String> {
    let career_guard = state.career.lock().unwrap();
    let career = career_guard
        .as_ref()
        .ok_or_else(|| "Nenhuma carreira iniciada".to_string())?;

    let saves_dir = get_saves_dir()?;
    
    // Sanitizar nome do arquivo
    let safe_name = save_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let filename = format!("{}_{}.json", safe_name, timestamp);
    let filepath = saves_dir.join(&filename);
    
    // Serializar carreira
    let json = serde_json::to_string_pretty(career)
        .map_err(|e| format!("Erro ao serializar carreira: {}", e))?;
    
    fs::write(&filepath, json)
        .map_err(|e| format!("Erro ao salvar arquivo: {}", e))?;
    
    Ok(filename)
}

#[tauri::command]
fn list_saves() -> Result<Vec<SaveMetadata>, String> {
    let saves_dir = get_saves_dir()?;
    
    let mut saves = Vec::new();
    
    if saves_dir.exists() {
        let entries = fs::read_dir(&saves_dir)
            .map_err(|e| format!("Erro ao ler diretório: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Erro ao ler entrada: {}", e))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(career) = serde_json::from_str::<CareerState>(&content) {
                        // Extrair metadata
                        let filename = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        
                        // Extrair timestamp do nome do arquivo
                        let timestamp = filename
                            .rsplit('_')
                            .next()
                            .and_then(|s| s.strip_suffix(".json"))
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(0);
                        
                        let current_round = career
                            .seasons
                            .get(&career.player_league_id)
                            .map(|s| s.current_round)
                            .unwrap_or(0);
                        
                        saves.push(SaveMetadata {
                            name: filename,
                            coach_name: career.coach_name.clone(),
                            team_name: String::new(), // TODO: extrair do career
                            league_id: career.player_league_id.clone(),
                            current_round,
                            morale: career.morale,
                            timestamp,
                        });
                    }
                }
            }
        }
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    saves.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    Ok(saves)
}

#[tauri::command]
fn load_career(
    filename: String,
    state: State<AppState>,
) -> Result<CareerSnapshotDto, String> {
    // Limpar escalação ao carregar save
    {
        let mut lineup_guard = state.lineup.lock().unwrap();
        *lineup_guard = None;
    }

    let saves_dir = get_saves_dir()?;
    let filepath = saves_dir.join(&filename);
    
    if !filepath.exists() {
        return Err("Save não encontrado".to_string());
    }
    
    let content = fs::read_to_string(&filepath)
        .map_err(|e| format!("Erro ao ler arquivo: {}", e))?;
    
    let career: CareerState = serde_json::from_str(&content)
        .map_err(|e| format!("Erro ao deserializar carreira: {}", e))?;
    
    let mut leagues_guard = state.leagues.lock().unwrap();
    ensure_leagues_loaded(&mut leagues_guard)?;
    let all_leagues = leagues_guard.as_ref().unwrap();
    
    let snapshot = snapshot(&career, all_leagues);
    
    let mut career_guard = state.career.lock().unwrap();
    *career_guard = Some(career);
    
    Ok(snapshot)
}

#[tauri::command]
fn delete_save(filename: String) -> Result<(), String> {
    let saves_dir = get_saves_dir()?;
    let filepath = saves_dir.join(&filename);
    
    if filepath.exists() {
        fs::remove_file(&filepath)
            .map_err(|e| format!("Erro ao deletar save: {}", e))?;
    }
    
    Ok(())
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
            debug_paths,
            test_json_loading,
            fetch_leagues,
            fetch_league,
            start_new_career,
            start_new_career_multi,
            simulate_career_round,
            get_career_snapshot,
            get_calendar_data,
            save_lineup,
            get_player_energies,
            get_lineup,
            advance_to_next_season,
            list_coach_job_offers,
            accept_coach_job_offer,
            save_career,
            load_career,
            list_saves,
            delete_save,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o app");
}