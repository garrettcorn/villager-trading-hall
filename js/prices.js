/* Trade price calculation for Java and Bedrock editions.
 *
 * Implements the formulas from the Minecraft Wiki "Trading / Sale prices"
 * section (current mechanics, incl. 1.20.2+ first-cure permanent discount).
 *
 *   Java:    final = min(max( floor(p*(m*max(0,d)+1)) - floor(m*r)
 *                            - sgn(h)*max(1, floor(p*(0.3+0.0625*(h-1))))
 *                          , 1), stack)
 *   Bedrock: final = min(max( floor(p*(m*max(0,d)+1)) - floor(m*max(0,r))
 *                            - sgn(h)*max(1, floor(p*(0.3+0.0625*(h-1))))
 *                          , 1), stack)
 *
 * p = base price, m = price multiplier, d = demand, r = reputation,
 * h = Hero of the Village level (0 = not active).
 */
"use strict";

function heroDiscount(basePrice, heroLevel) {
  const h = Math.max(0, Math.floor(heroLevel || 0));
  if (h <= 0 || basePrice <= 0) return 0;
  const rate = HERO_DISCOUNTS[h] || HERO_DISCOUNTS[HERO_DISCOUNTS.length - 1];
  return Math.max(1, Math.floor(basePrice * rate));
}

/* The permanent discount (in emeralds) granted by the first cure.
 * Based on +20 major-positive reputation scaled by the trade's multiplier. */
function cureDiscount(multiplier) {
  return Math.floor(multiplier * CURE_REPUTATION);
}

function computePrice(opts) {
  const p = Math.max(0, Math.floor(opts.base || 0));
  const m = opts.multiplier || 0;
  const d = Math.floor(opts.demand || 0);
  let r = Math.floor(opts.reputation || 0);
  const h = Math.max(0, Math.floor(opts.heroLevel || 0));
  const stack = Math.max(1, Math.floor(opts.stackSize || 64));

  if (opts.version === "bedrock") r = Math.max(0, r);

  const demandTerm = Math.floor(p * (m * Math.max(0, d) + 1));
  const reputationTerm = Math.floor(m * r);
  const heroTerm = heroDiscount(p, h);

  let price = demandTerm - reputationTerm - heroTerm;
  price = Math.min(Math.max(price, 1), stack);

  return {
    version: opts.version === "bedrock" ? "bedrock" : "java",
    base: p,
    multiplier: m,
    demand: d,
    reputation: r,
    heroLevel: h,
    demandTerm: demandTerm,
    reputationTerm: reputationTerm,
    heroTerm: heroTerm,
    final: price,
  };
}

/* Shortcut: compute the final price a player pays for a trade, given whether
 * the villager has been cured and the player's current Hero of the Village
 * level. Demand defaults to 0 (fresh trade). */
function finalTradePrice(trade, version, cured, heroLevel, stackSize) {
  const reputation = cured ? CURE_REPUTATION : 0;
  return computePrice({
    version: version,
    base: trade.price,
    multiplier: trade.multiplier,
    demand: trade.demand || 0,
    reputation: reputation,
    heroLevel: heroLevel || 0,
    stackSize: stackSize,
  });
}
