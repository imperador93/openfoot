use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tactics {
    pub formation: Formation,
    pub play_style: PlayStyle,
}

impl Default for Tactics {
    fn default() -> Self {
        Self {
            formation: Formation::F442,
            play_style: PlayStyle::Normal,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Formation {
    #[serde(rename = "4-4-2")]
    F442,
    #[serde(rename = "4-3-3")]
    F433,
    #[serde(rename = "3-5-2")]
    F352,
    #[serde(rename = "5-3-2")]
    F532,
    #[serde(rename = "4-5-1")]
    F451,
    #[serde(rename = "3-4-3")]
    F343,
}

impl Formation {
    /// (defensores, meias, atacantes) — goleiro e sempre 1
    pub fn zone_counts(&self) -> (f64, f64, f64) {
        match self {
            Formation::F442 => (4.0, 4.0, 2.0),
            Formation::F433 => (4.0, 3.0, 3.0),
            Formation::F352 => (3.0, 5.0, 2.0),
            Formation::F532 => (5.0, 3.0, 2.0),
            Formation::F451 => (4.0, 5.0, 1.0),
            Formation::F343 => (3.0, 4.0, 3.0),
        }
    }

    /// Multiplicador por zona relativo ao baseline 4-4-2
    pub fn zone_multiplier(&self, zone: TacticsZone) -> f64 {
        let (def, mid, atk) = self.zone_counts();
        match zone {
            TacticsZone::Defense => def / 4.0,
            TacticsZone::Midfield => mid / 4.0,
            TacticsZone::Attack => atk / 2.0,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum TacticsZone {
    Defense,
    Midfield,
    Attack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlayStyle {
    #[serde(rename = "Pressing Alto")]
    PressingAlto,
    #[serde(rename = "Posse de Bola")]
    PosseDeBola,
    #[serde(rename = "Contra-ataque")]
    Contraataque,
    #[serde(rename = "Bola Direta")]
    BolaDireta,
    #[serde(rename = "Jogo Aereo")]
    JogoAereo,
    #[serde(rename = "Normal")]
    Normal,
}

impl PlayStyle {
    /// Modificadores de zona: (defesa, meio, ataque)
    pub fn zone_modifiers(&self) -> (f64, f64, f64) {
        match self {
            PlayStyle::PressingAlto => (0.95, 1.15, 1.00),
            PlayStyle::PosseDeBola => (1.00, 1.10, 0.95),
            PlayStyle::Contraataque => (1.10, 0.90, 1.15),
            PlayStyle::BolaDireta => (1.00, 0.85, 1.20),
            PlayStyle::JogoAereo => (1.05, 0.95, 1.10),
            PlayStyle::Normal => (1.00, 1.00, 1.00),
        }
    }

    /// Pesos dos ShotTypes: [Normal, CounterAttack, LongShot, Individual, Header, FreeKick]
    pub fn shot_type_weights(&self) -> [u32; 6] {
        match self {
            PlayStyle::PressingAlto => [2, 3, 1, 2, 1, 1],
            PlayStyle::PosseDeBola => [3, 1, 1, 3, 1, 1],
            PlayStyle::Contraataque => [1, 5, 1, 1, 1, 1],
            PlayStyle::BolaDireta => [2, 1, 3, 1, 2, 1],
            PlayStyle::JogoAereo => [1, 1, 1, 1, 5, 1],
            PlayStyle::Normal => [3, 1, 1, 1, 1, 1],
        }
    }
}
