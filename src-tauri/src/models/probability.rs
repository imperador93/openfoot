use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub enum ShotType {
    #[default]
    Normal,
    CounterAttack,
    LongShot,
    Individual,
    Header,
    FreeKick,
    Penalty,
}

pub fn goal_probability(attacker_strength: f64, goalkeeper_def: f64) -> f64 {
    let attacker_sq = attacker_strength.powi(2);
    let goalkeeper_sq = goalkeeper_def.powi(2);
    let denominator = attacker_sq + goalkeeper_sq;

    if denominator <= 0.0 {
        return 0.0;
    }

    // Com forças iguais retorna ~0.175 (17.5% de chance) — conversão realista
    (attacker_sq / denominator * 0.35).clamp(0.0, 1.0)
}

pub fn apply_creator_bonus(base_strength: f64, creator_pas: f64) -> f64 {
    base_strength * (1.0 + creator_pas / 500.0)
}

pub fn shot_type_strength(sht: f64, spd: f64, drb: f64, str_: f64, shot_type: ShotType) -> f64 {
    match shot_type {
        ShotType::Normal => sht,
        ShotType::CounterAttack => (sht + spd) / 2.0,
        ShotType::LongShot => sht * 0.6,
        ShotType::Individual => (drb + sht) / 2.0,
        ShotType::Header => str_,
        ShotType::FreeKick => sht,
        ShotType::Penalty => sht,
    }
}

pub fn zone_contest(team_a_strength: f64, team_b_strength: f64) -> bool {
    let team_a_sq = team_a_strength.powi(2);
    let team_b_sq = team_b_strength.powi(2);
    let denominator = team_a_sq + team_b_sq;

    if denominator <= 0.0 {
        return false;
    }

    let team_a_probability = (team_a_sq / denominator).clamp(0.0, 1.0);
    rand::random::<f64>() < team_a_probability
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn goal_probability_with_equal_strengths_is_about_point_twenty_five() {
        let value = goal_probability(50.0, 50.0);
        assert!((value - 0.25).abs() < 1e-9);
    }

    #[test]
    fn goal_probability_is_between_zero_and_one() {
        let value = goal_probability(72.0, 81.0);
        assert!((0.0..=1.0).contains(&value));
    }

    #[test]
    fn creator_bonus_with_zero_passing_returns_base() {
        let value = apply_creator_bonus(80.0, 0.0);
        assert!((value - 80.0).abs() < 1e-9);
    }

    #[test]
    fn creator_bonus_with_hundred_passing_returns_one_point_two_x() {
        let value = apply_creator_bonus(80.0, 100.0);
        assert!((value - 96.0).abs() < 1e-9);
    }

    #[test]
    fn counter_attack_strength_is_average_of_shooting_and_speed() {
        let value = shot_type_strength(80.0, 70.0, 60.0, 65.0, ShotType::CounterAttack);
        assert!((value - 75.0).abs() < 1e-9);
    }
}
