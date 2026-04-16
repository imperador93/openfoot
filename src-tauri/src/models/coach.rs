use serde::{Deserialize, Serialize};
use crate::models::tactics::{Formation, PlayStyle, Tactics};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Coach {
    pub id: String,
    pub name: String,
    pub overall: u8,
    pub experience: u8,
    /// Formação preferida do técnico, ex: "3-5-2"
    pub tactics: String,
}

impl Coach {
    /// Deriva a tática completa (formação + estilo) a partir dos atributos do técnico.
    ///
    /// Sistema de aleatoriedade 80%/20%:
    /// - 80% de chance de usar o estilo principal baseado em overall/experience
    /// - 20% de chance de usar o estilo alternativo do mesmo grupo
    ///
    /// Grupos de estilos:
    /// - overall ≥75 → principal: PosseDeBola (exp ≥25) / PressingAlto, alternativo: PressingAlto / PosseDeBola
    /// - overall 55–74 → principal: JogoAereo (exp ≥20) / Normal, alternativo: Normal / JogoAereo
    /// - overall <55 → principal: Contraataque (exp ≥15) / BolaDireta, alternativo: BolaDireta / Contraataque
    pub fn derive_tactics(&self) -> Tactics {
        let formation = Formation::from_str(&self.tactics).unwrap_or_default();
        
        let mut rng = rand::thread_rng();
        let use_primary = rng.gen::<f64>() < 0.80;
        
        let play_style = match self.overall {
            75..=u8::MAX => {
                let primary_is_posse = self.experience >= 25;
                if use_primary {
                    if primary_is_posse {
                        PlayStyle::PosseDeBola
                    } else {
                        PlayStyle::PressingAlto
                    }
                } else {
                    // 20% chance: usa o alternativo
                    if primary_is_posse {
                        PlayStyle::PressingAlto
                    } else {
                        PlayStyle::PosseDeBola
                    }
                }
            }
            55..=74 => {
                let primary_is_aereo = self.experience >= 20;
                if use_primary {
                    if primary_is_aereo {
                        PlayStyle::JogoAereo
                    } else {
                        PlayStyle::Normal
                    }
                } else {
                    if primary_is_aereo {
                        PlayStyle::Normal
                    } else {
                        PlayStyle::JogoAereo
                    }
                }
            }
            _ => {
                let primary_is_contraataque = self.experience >= 15;
                if use_primary {
                    if primary_is_contraataque {
                        PlayStyle::Contraataque
                    } else {
                        PlayStyle::BolaDireta
                    }
                } else {
                    if primary_is_contraataque {
                        PlayStyle::BolaDireta
                    } else {
                        PlayStyle::Contraataque
                    }
                }
            }
        };
        
        Tactics { formation, play_style }
    }
}
