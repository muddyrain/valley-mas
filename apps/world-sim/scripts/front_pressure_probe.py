#!/usr/bin/env python3
"""Probe the proposed front-pressure attack probability model.

This is a local design probe, not production simulation code. It mirrors the
TDD boundary: aggregate front pressure only; no soldier entities, no pathfinding,
and no per-province garrison diffusion.
"""

from __future__ import annotations

from dataclasses import dataclass


TERRAIN_ATTACK_PROB = {
    "plain": 0.55,
    "desert": 0.55,
    "forest": 0.50,
    "river": 0.40,
    "mountain": 0.32,
}


@dataclass(frozen=True)
class Allocation:
    troops: float
    supply: float = 1.0
    multi_front_penalty: float = 0.0


@dataclass(frozen=True)
class Scenario:
    name: str
    terrain: str
    attacker: Allocation
    defender: Allocation
    collapse_bias: float = 0.0
    local_surround_bias: float = 0.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def power_ratio_bias(attacker_power: float, defender_power: float, scale: float = 0.35) -> float:
    total = attacker_power + defender_power
    if total <= 0:
        return 0.0
    ratio = attacker_power / total
    return (ratio - 0.5) * scale


def resolve_attack_probability(scenario: Scenario) -> tuple[float, dict[str, float]]:
    attacker_power = scenario.attacker.troops * scenario.attacker.supply
    defender_power = scenario.defender.troops * scenario.defender.supply
    terrain_base = TERRAIN_ATTACK_PROB[scenario.terrain]
    front_bias = power_ratio_bias(attacker_power, defender_power)

    probability = (
        terrain_base
        + front_bias
        + scenario.local_surround_bias
        + scenario.collapse_bias
        - scenario.attacker.multi_front_penalty
    )

    return clamp(probability, 0.02, 0.98), {
        "terrain_base": terrain_base,
        "attacker_power": attacker_power,
        "defender_power": defender_power,
        "front_bias": front_bias,
        "local_surround_bias": scenario.local_surround_bias,
        "collapse_bias": scenario.collapse_bias,
        "multi_front_penalty": scenario.attacker.multi_front_penalty,
    }


def format_percent(value: float) -> str:
    return f"{value * 100:5.1f}%"


def run_probe() -> None:
    scenarios = [
        Scenario(
            name="balanced_plain_front",
            terrain="plain",
            attacker=Allocation(troops=1000),
            defender=Allocation(troops=1000),
        ),
        Scenario(
            name="attacker_concentrates_single_front",
            terrain="plain",
            attacker=Allocation(troops=1800),
            defender=Allocation(troops=900),
        ),
        Scenario(
            name="large_faction_spread_across_many_fronts",
            terrain="plain",
            attacker=Allocation(troops=900, multi_front_penalty=0.06),
            defender=Allocation(troops=1200),
        ),
        Scenario(
            name="mountain_defense_even_with_more_attackers",
            terrain="mountain",
            attacker=Allocation(troops=1800),
            defender=Allocation(troops=900),
        ),
        Scenario(
            name="surrounded_tiny_realm_late_game",
            terrain="plain",
            attacker=Allocation(troops=1600, supply=0.95),
            defender=Allocation(troops=700),
            collapse_bias=0.10,
            local_surround_bias=0.04,
        ),
        Scenario(
            name="overextended_far_front",
            terrain="forest",
            attacker=Allocation(troops=1800, supply=0.70, multi_front_penalty=0.04),
            defender=Allocation(troops=1100, supply=1.0),
        ),
    ]

    rows = []
    for scenario in scenarios:
        probability, detail = resolve_attack_probability(scenario)
        rows.append((scenario, probability, detail))

    print("front-pressure probability probe")
    print("-" * 112)
    print(
        f"{'scenario':40} {'terrain':8} {'power':>15} {'base':>8} {'front':>8} "
        f"{'sur':>8} {'coll':>8} {'multi':>8} {'win':>8}"
    )
    print("-" * 112)
    for scenario, probability, detail in rows:
        power = f"{detail['attacker_power']:.0f}:{detail['defender_power']:.0f}"
        print(
            f"{scenario.name:40} {scenario.terrain:8} {power:>15} "
            f"{format_percent(detail['terrain_base']):>8} "
            f"{format_percent(detail['front_bias']):>8} "
            f"{format_percent(detail['local_surround_bias']):>8} "
            f"{format_percent(detail['collapse_bias']):>8} "
            f"{format_percent(detail['multi_front_penalty']):>8} "
            f"{format_percent(probability):>8}"
        )

    by_name = {scenario.name: probability for scenario, probability, _ in rows}
    assert by_name["balanced_plain_front"] == 0.55
    assert by_name["attacker_concentrates_single_front"] > by_name["balanced_plain_front"]
    assert by_name["large_faction_spread_across_many_fronts"] < by_name["balanced_plain_front"]
    assert by_name["mountain_defense_even_with_more_attackers"] < by_name["balanced_plain_front"]
    assert by_name["surrounded_tiny_realm_late_game"] > by_name["attacker_concentrates_single_front"]
    assert by_name["overextended_far_front"] < by_name["attacker_concentrates_single_front"]

    print("-" * 112)
    print("PASS: all directional expectations match the front-pressure design.")


if __name__ == "__main__":
    run_probe()
