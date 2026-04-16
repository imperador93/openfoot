// src-tauri/src/models/team.rs
use serde::{Deserialize, Serialize};
use crate::models::Player;
use crate::models::coach::Coach;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Team {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub stadium: String,
    pub league_id: String,
    #[serde(default = "default_team_tier")]
    pub tier: u8,
    #[serde(default)]
    pub budget: i64,
    #[serde(default)]
    pub coach: Option<Coach>,
    #[serde(default)]
    pub squad: Vec<Player>,
}

fn default_team_tier() -> u8 { 3 }

impl Team {
    /// Força do time — média dos overalls dos 11 melhores titulares.
    /// Usado pelo match engine para calcular probabilidades.
    pub fn strength(&self) -> f32 {
        let mut sorted: Vec<u8> = self.squad.iter().map(|p| p.overall()).collect();
        sorted.sort_unstable_by(|a, b| b.cmp(a));
        let top11: Vec<u8> = sorted.into_iter().take(11).collect();
        if top11.is_empty() {
            return 50.0;
        }
        top11.iter().map(|&v| v as f32).sum::<f32>() / top11.len() as f32
    }

    /// Retorna os 11 titulares ordenados por posição,
    /// espelhando a lógica do LoadRosterForSelection() do MainForm.cs.
    pub fn starters(&self) -> Vec<&Player> {
        use crate::models::player::PlayerStatus;
        let mut starters: Vec<&Player> = self
            .squad
            .iter()
            .filter(|p| p.status == PlayerStatus::Titular)
            .collect();
        starters.sort_by_key(|p| p.position.display_rank());
        starters
    }

    /// Calcula orçamento inicial baseado no tier da liga e do clube
    pub fn calculate_initial_budget(league_tier: u8, team_tier: u8) -> i64 {
        use rand::Rng;
        
        // Base por tier da liga
        let base = match league_tier {
            1 => 100_000_000,  // R$ 100M (La Liga, Premier League)
            2 => 50_000_000,   // R$ 50M (Brasileirão Série A)
            3 => 25_000_000,   // R$ 25M (Série B, ligas menores tier 2)
            4 => 12_000_000,   // R$ 12M (Séries inferiores)
            _ => 5_000_000,    // R$ 5M (default)
        };
        
        // Multiplicador por tier do clube
        let multiplier = match team_tier {
            1 => 1.0,   // Elite (100%)
            2 => 0.7,   // Grande (70%)
            3 => 0.5,   // Médio (50%)
            _ => 0.3,   // Pequeno (30%)
        };
        
        // Variação aleatória de ±10%
        let variation = rand::thread_rng().gen_range(0.90..=1.10);
        
        (base as f64 * multiplier * variation) as i64
    }
}

/// Schema do teams.json — lista de times com seus TeamIds e LeagueId.
/// O campo Players é populado depois pelo DataLoader cruzando players.json.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct TeamsFile {
    pub teams: Vec<TeamRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct TeamRecord {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub stadium: String,
    pub league_id: String,
    #[serde(default = "default_team_tier")]
    pub tier: u8,
    #[serde(default)]
    pub coach: Option<Coach>,
}