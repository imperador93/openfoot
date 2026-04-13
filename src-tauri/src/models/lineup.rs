use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SlotZone {
    #[serde(rename = "GOL")]
    Gol,
    #[serde(rename = "DEF")]
    Def,
    #[serde(rename = "MEI")]
    Mei,
    #[serde(rename = "ATA")]
    Ata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineupSlot {
    pub player_id: String,
    pub slot_zone: SlotZone,
    pub slot_index: u8,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLineup {
    pub starters: Vec<LineupSlot>,
    pub bench: Vec<String>,
}

impl SavedLineup {
    pub fn starter_ids(&self) -> Vec<String> {
        self.starters.iter().map(|slot| slot.player_id.clone()).collect()
    }

    pub fn starter_slot_zones(&self) -> HashMap<String, SlotZone> {
        self.starters
            .iter()
            .map(|slot| (slot.player_id.clone(), slot.slot_zone))
            .collect()
    }
}