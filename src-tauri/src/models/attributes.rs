use serde::{Deserialize, Serialize};

use crate::models::lineup::SlotZone;
use crate::models::player::{Player, Position};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Attributes {
    pub spd: u8,
    pub sht: u8,
    pub pas: u8,
    pub drb: u8,
    pub def: u8,
    pub sta: u8,
    pub str_: u8,
}

impl Default for Attributes {
    fn default() -> Self {
        Self {
            spd: 50,
            sht: 50,
            pas: 50,
            drb: 50,
            def: 50,
            sta: 50,
            str_: 50,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Zone {
    Defense,
    Midfield,
    Attack,
}

impl Default for Zone {
    fn default() -> Self {
        Self::Midfield
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum AttributeKind {
    SPD,
    SHT,
    PAS,
    DRB,
    DEF,
    STA,
    STR,
}

impl Default for AttributeKind {
    fn default() -> Self {
        Self::STA
    }
}

impl Attributes {
    pub fn from_player(player: &Player) -> Self {
        // Legacy data does not have STR; attackers use speed as a better proxy.
        Self {
            spd: player.speed,
            sht: player.shooting,
            pas: player.passing,
            drb: player.dribbling,
            def: player.defense,
            sta: player.stamina,
            str_: match player.position {
                Position::ATA | Position::SA => player.speed,
                _ => player.defense,
            },
        }
    }

    pub fn overall(&self, position: &Position) -> f64 {
        let primary = position_primary(position);
        let secondary = position_secondary(position);
        let tertiary = position_tertiary(position);

        let primary_avg = mean_effective_attrs(self, &primary, self.sta);
        let secondary_avg = mean_effective_attrs(self, &secondary, self.sta);
        let tertiary_avg = mean_effective_attrs(self, &tertiary, self.sta);

        (primary_avg * 0.6) + (secondary_avg * 0.3) + (tertiary_avg * 0.1)
    }

    pub fn get_effective_attribute(&self, attr: AttributeKind, sta_atual: u8) -> f64 {
        let base = self.attribute_value(attr) as f64;
        let sta_factor = 0.4 + (sta_atual.min(100) as f64 / 100.0) * 0.6;
        base * sta_factor
    }

    fn attribute_value(&self, attr: AttributeKind) -> u8 {
        match attr {
            AttributeKind::SPD => self.spd,
            AttributeKind::SHT => self.sht,
            AttributeKind::PAS => self.pas,
            AttributeKind::DRB => self.drb,
            AttributeKind::DEF => self.def,
            AttributeKind::STA => self.sta,
            AttributeKind::STR => self.str_,
        }
    }
}

pub fn zone_strength(players: &[Player], zone: Zone) -> f64 {
    let zone_players: Vec<&Player> = players
        .iter()
        .filter(|p| position_zone(&p.position) == zone)
        .collect();

    if zone_players.is_empty() {
        return 0.0;
    }

    let base_strength = zone_players
        .iter()
        .map(|player| {
            let attrs = Attributes::from_player(player);
            let primary = position_primary(&player.position);
            mean_effective_attrs(&attrs, &primary, player.stamina)
        })
        .sum::<f64>()
        / zone_players.len() as f64;

    // With a single-team signature, numeric superiority is approximated
    // against a tactical baseline per zone.
    let baseline = zone_baseline_count(zone);
    let extra_players = zone_players.len().saturating_sub(baseline);
    let superiority_multiplier = 1.0 + (extra_players as f64 * 0.05);

    base_strength * superiority_multiplier
}

pub fn natural_slot_zone(position: &Position) -> SlotZone {
    match position {
        Position::GOL => SlotZone::Gol,
        Position::ZAG | Position::LAT_E | Position::LAT_D => SlotZone::Def,
        Position::VOL | Position::MEI | Position::MEI_A => SlotZone::Mei,
        Position::PNT_E | Position::PNT_D | Position::SA | Position::ATA => SlotZone::Ata,
    }
}

/// Multiplicador de desempenho ao atuar fora da zona natural.
pub fn out_of_position_multiplier(player_position: &Position, slot_zone: &SlotZone) -> f64 {
    if matches!(player_position, Position::GOL) && !matches!(slot_zone, SlotZone::Gol) {
        return 0.20;
    }

    if !matches!(player_position, Position::GOL) && matches!(slot_zone, SlotZone::Gol) {
        return 0.25;
    }

    let natural_zone = natural_slot_zone(player_position);
    match (natural_zone, *slot_zone) {
        (SlotZone::Gol, SlotZone::Gol) => 1.00,
        (SlotZone::Def, SlotZone::Def) => 1.00,
        (SlotZone::Mei, SlotZone::Mei) => 1.00,
        (SlotZone::Ata, SlotZone::Ata) => 1.00,
        (SlotZone::Def, SlotZone::Mei) | (SlotZone::Mei, SlotZone::Def) => 0.65,
        (SlotZone::Mei, SlotZone::Ata) | (SlotZone::Ata, SlotZone::Mei) => 0.65,
        (SlotZone::Def, SlotZone::Ata) | (SlotZone::Ata, SlotZone::Def) => 0.40,
        _ => 1.00,
    }
}

fn mean_effective_attrs(attrs: &Attributes, kinds: &[AttributeKind], sta_atual: u8) -> f64 {
    kinds
        .iter()
        .map(|kind| attrs.get_effective_attribute(kind.clone(), sta_atual))
        .sum::<f64>()
        / kinds.len() as f64
}

fn position_primary(position: &Position) -> [AttributeKind; 3] {
    match position {
        Position::GOL => [AttributeKind::DEF, AttributeKind::STR, AttributeKind::SPD],
        Position::ZAG => [AttributeKind::DEF, AttributeKind::STR, AttributeKind::SPD],
        Position::LAT_E => [AttributeKind::SPD, AttributeKind::DEF, AttributeKind::STA],
        Position::LAT_D => [AttributeKind::SPD, AttributeKind::DEF, AttributeKind::STA],
        Position::VOL => [AttributeKind::DEF, AttributeKind::PAS, AttributeKind::STA],
        Position::MEI => [AttributeKind::PAS, AttributeKind::DEF, AttributeKind::STA],
        Position::MEI_A => [AttributeKind::PAS, AttributeKind::SHT, AttributeKind::DRB],
        Position::PNT_E => [AttributeKind::SPD, AttributeKind::DRB, AttributeKind::SHT],
        Position::PNT_D => [AttributeKind::SPD, AttributeKind::DRB, AttributeKind::SHT],
        Position::SA => [AttributeKind::SHT, AttributeKind::SPD, AttributeKind::DRB],
        Position::ATA => [AttributeKind::SHT, AttributeKind::SPD, AttributeKind::STR],
    }
}

fn position_secondary(position: &Position) -> [AttributeKind; 2] {
    match position {
        Position::GOL => [AttributeKind::STA, AttributeKind::PAS],
        Position::ZAG => [AttributeKind::STA, AttributeKind::PAS],
        Position::LAT_E => [AttributeKind::PAS, AttributeKind::STR],
        Position::LAT_D => [AttributeKind::PAS, AttributeKind::STR],
        Position::VOL => [AttributeKind::STR, AttributeKind::SPD],
        Position::MEI => [AttributeKind::SPD, AttributeKind::DRB],
        Position::MEI_A => [AttributeKind::SPD, AttributeKind::STA],
        Position::PNT_E => [AttributeKind::PAS, AttributeKind::STA],
        Position::PNT_D => [AttributeKind::PAS, AttributeKind::STA],
        Position::SA => [AttributeKind::PAS, AttributeKind::STA],
        Position::ATA => [AttributeKind::STA, AttributeKind::DRB],
    }
}

fn position_tertiary(position: &Position) -> [AttributeKind; 2] {
    match position {
        Position::GOL => [AttributeKind::SHT, AttributeKind::DRB],
        Position::ZAG => [AttributeKind::SHT, AttributeKind::DRB],
        Position::LAT_E => [AttributeKind::SHT, AttributeKind::DRB],
        Position::LAT_D => [AttributeKind::SHT, AttributeKind::DRB],
        Position::VOL => [AttributeKind::SHT, AttributeKind::DRB],
        Position::MEI => [AttributeKind::SHT, AttributeKind::STR],
        Position::MEI_A => [AttributeKind::DEF, AttributeKind::STR],
        Position::PNT_E => [AttributeKind::DEF, AttributeKind::STR],
        Position::PNT_D => [AttributeKind::DEF, AttributeKind::STR],
        Position::SA => [AttributeKind::DEF, AttributeKind::STR],
        Position::ATA => [AttributeKind::DEF, AttributeKind::PAS],
    }
}

fn position_zone(position: &Position) -> Zone {
    match position {
        Position::GOL | Position::ZAG | Position::LAT_E | Position::LAT_D => Zone::Defense,
        Position::VOL | Position::MEI | Position::MEI_A => Zone::Midfield,
        Position::PNT_E | Position::PNT_D | Position::SA | Position::ATA => Zone::Attack,
    }
}

fn zone_baseline_count(zone: Zone) -> usize {
    match zone {
        Zone::Defense => 4,
        Zone::Midfield => 3,
        Zone::Attack => 3,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::player::PlayerStatus;

    fn make_player(id: &str, position: Position, speed: u8, shooting: u8, passing: u8, dribbling: u8, defense: u8, stamina: u8) -> Player {
        Player {
            id: id.to_string(),
            name: format!("Player {id}"),
            position,
            speed,
            shooting,
            passing,
            dribbling,
            defense,
            stamina,
            team_id: "t-1".to_string(),
            league_id: "l-1".to_string(),
            status: PlayerStatus::default(),
        }
    }

    #[test]
    fn overall_returns_value_between_zero_and_hundred() {
        let attrs = Attributes {
            spd: 88,
            sht: 79,
            pas: 84,
            drb: 82,
            def: 58,
            sta: 90,
            str_: 73,
        };

        let value = attrs.overall(&Position::MEI_A);
        assert!((0.0..=100.0).contains(&value));
    }

    #[test]
    fn effective_attribute_with_full_stamina_returns_base_value() {
        let attrs = Attributes {
            spd: 80,
            ..Attributes::default()
        };

        let v = attrs.get_effective_attribute(AttributeKind::SPD, 100);
        assert!((v - 80.0).abs() < 1e-9);
    }

    #[test]
    fn effective_attribute_with_zero_stamina_returns_forty_percent() {
        let attrs = Attributes {
            pas: 75,
            ..Attributes::default()
        };

        let v = attrs.get_effective_attribute(AttributeKind::PAS, 0);
        assert!((v - 30.0).abs() < 1e-9);
    }

    #[test]
    fn zone_strength_with_numeric_superiority_is_higher() {
        let mut base_team = vec![
            make_player("1", Position::ATA, 80, 85, 70, 78, 60, 90),
            make_player("2", Position::SA, 78, 82, 72, 80, 58, 88),
            make_player("3", Position::PNT_E, 84, 79, 74, 83, 55, 87),
        ];

        let mut superior_team = base_team.clone();
        superior_team.push(make_player("4", Position::PNT_D, 82, 80, 73, 81, 56, 89));

        let base = zone_strength(&base_team, Zone::Attack);
        let superior = zone_strength(&superior_team, Zone::Attack);

        assert!(superior > base);

        // Avoid unused mut warning if test changes in future.
        base_team.clear();
    }
}
