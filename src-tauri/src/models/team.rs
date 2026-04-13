// src-tauri/src/models/team.rs
use serde::{Deserialize, Serialize};
use crate::models::Player;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Team {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub stadium: String,
    pub league_id: String,
    #[serde(default)]
    pub squad: Vec<Player>,
}

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
}