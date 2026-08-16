#!/usr/bin/env python3
"""Price engine tests for the Villager Trading Hall tracker.

Ports the logic in js/prices.js (which implements the Minecraft Wiki
"Trading / Sale prices" formulas) and asserts against known values,
including the wiki's own worked example.
"""
import sys

CURE_REPUTATION = 20
HERO_DISCOUNTS = [0, 0.3, 0.3625, 0.425, 0.4875, 0.55]


def hero_discount(base_price, hero_level):
    h = max(0, int(hero_level or 0))
    if h <= 0 or base_price <= 0:
        return 0
    return max(1, int(base_price * HERO_DISCOUNTS[h]))


def compute_price(version, base, multiplier, demand, reputation, hero_level, stack_size=64):
    p = max(0, int(base))
    m = multiplier
    d = int(demand)
    r = int(reputation)
    h = hero_level
    if version == "bedrock":
        r = max(0, r)
    demand_term = int(p * (m * max(0, d) + 1))
    reputation_term = int(m * r)
    hero_term = hero_discount(p, h)
    price = demand_term - reputation_term - hero_term
    return min(max(price, 1), stack_size)


def check(label, actual, expected):
    if actual != expected:
        print("FAIL %s: expected %s, got %s" % (label, expected, actual))
        return False
    print("ok   %s -> %s" % (label, actual))
    return True


def main():
    ok = True

    # Wiki worked example: Hero of the Village III on a 14-emerald trade,
    # 42.5% discount = 5 emeralds off -> final 9.
    ok &= check("wiki example: hero III, base 14", compute_price("java", 14, 0.2, 0, 0, 3), 9)

    # Hero V on 20 emeralds -> 55% -> floor(11) -> 9.
    ok &= check("hero V, base 20", compute_price("java", 20, 0.2, 0, 0, 5), 9)

    # Curing discount = floor(multiplier x 20).
    ok &= check("cure, mult 0.3 (books), base 20", compute_price("java", 20, 0.3, 0, CURE_REPUTATION, 0), 14)
    ok &= check("cure, mult 0.2, base 20", compute_price("java", 20, 0.2, 0, CURE_REPUTATION, 0), 16)
    ok &= check("cure, mult 0.05, base 20", compute_price("java", 20, 0.05, 0, CURE_REPUTATION, 0), 19)

    # Cure + Hero I combine: base 20, mult 0.2 -> -4 cure, -6 hero -> 10.
    ok &= check("cure + hero I, base 20", compute_price("java", 20, 0.2, 0, CURE_REPUTATION, 1), 10)

    # Bedrock clamps negative reputation to 0 (can't raise prices); Java can.
    ok &= check("java negative rep raises price", compute_price("java", 10, 0.2, 0, -10, 0), 12)
    ok &= check("bedrock negative rep clamped", compute_price("bedrock", 10, 0.2, 0, -10, 0), 10)

    # Demand penalty: floor(p * (m*d + 1)).
    ok &= check("demand penalty", compute_price("java", 10, 0.2, 5, 0, 0), 20)

    # Prices can't go below 1.
    ok &= check("min price 1", compute_price("java", 1, 0.2, 0, CURE_REPUTATION, 1), 1)

    # Prices can't exceed stack size.
    ok &= check("stack clamp", compute_price("java", 64, 0.05, 0, 0, 0, stack_size=1), 1)

    if not ok:
        sys.exit(1)
    print("All price engine assertions passed.")


if __name__ == "__main__":
    main()
