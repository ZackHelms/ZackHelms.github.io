# Methodology: every factor, assumption, and source

Compiled 2026-09-22. Labels: **source** = taken from a named source, **inferred** = my
calculation from sourced numbers, **assumed** = a guess about the household.

## 1. Conversion factors (the `F` object in the compare page)

| Factor | Value | Label |
|---|---|---|
| Grid electricity CO2 | 0.35 kg/kWh | source: EIA 2024 (785 lb/MWh); eGRID 2024 341 g/kWh |
| Data center electricity CO2 | 0.35 kg/kWh | inferred: same US-average grid |
| Rooftop solar lifecycle CO2 | 0.041 kg/kWh | source: IPCC AR5 rooftop PV median (26-60 range) |
| Gasoline CO2 | 8.887 kg/gal | source: EPA |
| Average car | ~0.4 kg CO2/mi at 22 mpg | source: EPA |
| Natural gas CO2 | 53.06 kg/MMBtu | source: standard EPA factor (not re-verified in session) |
| Gasoline energy | 33.7 kWh/gal | source: EPA MPGe basis |
| Natural gas energy | 293.07 kWh/MMBtu | arithmetic |
| Grid water (power plants) | 4.35 L/kWh | source: LBNL 2024 as reported; USGS-based estimates are roughly half |
| Data center onsite cooling water | 0.37 L/kWh | inferred: LBNL 17.4 billion gal / 176 TWh (2023) |
| Gasoline water | 19 L/gal (~5 gal/gal) | inferred: Argonne 2.1-5.4 gal water per gal oil produced + ~1.5 gal refining |
| Source-to-site ratio, grid | 2.80 | source: EPA ENERGY STAR Portfolio Manager |
| Source-to-site ratio, onsite solar | 1.00 | source: same |
| Source-to-site ratio, natural gas | 1.05 | source: same |
| Ambient temperature for entropy | 293 K | assumed (room temperature) |
| One "kettle" | 0.1395 kWh | inferred: 1.5 L water, 20C to 100C |

Heat model: essentially all delivered energy ends up as low-grade heat. Grid and data
center electricity are multiplied by 2.80 to include power-plant and transmission losses;
solar by 1.00; natural gas by 1.05; liquid fuel by 1.00 of its 33.7 kWh/gal.

Entropy model: `S = Q / T0` with `T0 = 293 K`, reported in kJ/K. This is a simple estimate
of entropy added to the environment when high-quality energy is dissipated as ambient
heat. **inferred**, deliberately simplified.

## 2. The two family days

Shared inputs:
- Driving: 13,200 mi/yr total, two cars at ~6,600 mi each: a short ~5 mi round trip on
  ~240 days plus a long ~30 mi round trip on ~180 days, doubled for the second car.
  **assumed**: trip lengths were converted from drive times at ~30 mph, not measured.
- Home tap water: 300 gal/day = 1,136 L. **source**: EPA WaterSense average family.
- Excluded everywhere: food, goods, flights, embodied emissions of the house and cars.

**High end (id `fmax`)** - current setup plus the second driver:
- Grid electricity 7,234 kWh/yr = 19.82 kWh/day (appliances, AC, lighting, PC, misc plug
  loads, from the earlier per-item build on EIA RECS 2020 averages). **inferred**
- Natural gas 63.05 MMBtu/yr = 0.1727 MMBtu/day (44.9 heating + 18.15 water heating,
  RECS averages). **source + inferred**
- Gasoline 600 gal/yr = 1.644 gal/day at 22 mpg.
- Result: 30.71 kg CO2/day, 125.8 kWh/day site energy, 1,253 L/day water, 164.0 kWh/day
  heat, ~11.2 t CO2/yr.

**Low end (id `fmin`)** - solar, battery, all-electric, two hybrids:
- Electricity 12,424 kWh/yr = 34.04 kWh/day, all-electric with a heat pump and electric
  water heating, covered by rooftop solar at 41 g CO2/kWh lifecycle. **assumed** that the
  array is sized to cover annual use; a real system rarely nets to zero every month.
- Home battery: one 13.5 kWh unit at ~75 kg CO2 per kWh of capacity to manufacture
  (published estimates span 40-150), spread over 12 years = 0.23 kg/day. **inferred**
- Gasoline 264 gal/yr = 0.723 gal/day at 50 mpg conventional hybrids. **assumed**; real
  hybrids run ~40-57 mpg, and a plug-in charged from the solar would be much lower.
- Result: 8.05 kg CO2/day, 58.4 kWh/day site energy, 1,150 L/day water, 58.4 kWh/day heat,
  ~2.9 t CO2/yr.

Note the low end uses *more* site electricity than the high end, because heating and hot
water move from gas to electricity.

## 3. AI estimates

No per-token or per-prompt energy figures are published by Anthropic, so everything here
is third-party. **source: Earth911 reporting, Hausfather 2026.**

Per interaction:
| Item | Energy | Label |
|---|---|---|
| Short chat prompt | 0.3 Wh (0.24-0.8) | source: Google 0.24 Wh median Gemini prompt; OpenAI 0.34 Wh |
| Long Claude Sonnet prompt | 5.5 Wh (2.8-17) | source: Jegham et al. 2025 (Claude 3.7 Sonnet; extended thinking at the top of the range) |
| Median Claude Code session | 41 Wh | source: Couch 2026 (24 calls, 592k tokens) |
| Heavy Claude Code session | ~600 Wh (250-1,200) | source: Hausfather 2026 |
| Heavy agentic workday | 3.0 kWh (1.2-5.9) | source: Hausfather 2026 |

Dollar-to-energy bridge (**inferred**, used for the plan and session estimates): Hausfather
logged 3.2B tokens over 8 weeks with ~96% cache reads and estimated ~170 kWh (range
70-330). At Opus-class list prices that mix is about $0.80 per million tokens, which gives
roughly **27 / 66 / 129 Wh per API-equivalent dollar** for min / central / max.

Plan quotas (**inferred**, the biggest guess in the whole project): a fully used Max 20x
week measures around $1,100 of API-equivalent compute (source: Botfarm, described as a
lower bound, March 2026); the upper case assumes +50% for promo boosts and unmeasured
interactive use. Pro is assumed at $70-130/week, roughly one fifth of Max 5x. Weekly
energy: Pro 1.9 / 7 / 17 kWh; Max 20x 30 / 73 / 213 kWh. The per-day items divide by 7.

30-minute Opus extra-high session: **assumed** $3-15 of API-equivalent compute, converted
at the rates above, giving 81 Wh / 600 Wh / 1.9 kWh. The central value coincides with
Hausfather's median heavy session, which is the main reason to trust it at all.

Plan limits change over time (for example the 50% Claude Code weekly boost that ran
through Aug 31, 2026), so these should be re-checked, not treated as durable.

## 4. Household and outside items

Household per-use figures come from EIA RECS 2020 end-use data and ENERGY STAR appliance
figures, with a few **inferred** derivations:
- Oven at 350F for 20 min: ~1.2 kWh including preheat, from a 2.5 kW element with cycling.
- Spaghetti on an electric stove: ~0.85 kWh, from heating 3.8 kg of water by 85C at ~70%
  burner efficiency plus simmering.
- 10-min hot shower: ~2.4 kWh electric, from ~12.6 gal of hot water raised ~40C at ~92%
  tank efficiency; 79 L of direct water at 2.1 gpm.
- PC tower 24/7 at 100 W average (**assumed**, range 60-150 W).

Outside benchmarks:
| Item | Basis | Label |
|---|---|---|
| McDonald's-size restaurant | 4,500 sq ft at 81 kWh + 174k Btu per sq ft | source: DTE intensities via Energybox, inferred totals |
| Walmart supercenter | ~5-7 GWh/yr, back-calculated from an LED retrofit saving 340,000 kWh described as "more than 5%" | inferred |
| Gas station store | ~3,000 sq ft at ~94 kWh/sq ft | assumed size, source intensity |
| Fuel sold by one gas station | 141,813 gal/month | source: NACS 2023 |
| 18-hole golf course | ~2,400 MMBtu/yr median energy; ~120 acre-ft water (1.68M acre-ft nationally over ~14,000 facilities) | source: GCSAA, inferred per-course |
| Streetlight | ~520 kWh/yr, from a DOE survey of 11M luminaires using 5.7 billion kWh | inferred, older sodium-lamp fleet |
| US DoD | 59 Mt CO2e (2017); energy shown is operational fuel only (~86M barrels/yr) | source: Costs of War (Crawford) |
| US data centers | 176 TWh in 2023 | source: LBNL 2024 |
| Bitcoin network | ~177 TWh/yr | source: Cambridge CBECI; CO2 assumes the US grid, which is wrong but comparable |
| Average American | 17.2 t CO2e/yr all GHG (2023); 14 t energy CO2 (2024) | source: EIA / Statista |
| iPhone 17 | 55 kg lifecycle, 18% from charging | source: Apple product environmental report |
| SF-NY round trip flight | ~0.75 t CO2 per passenger, CO2 only | inferred from Hausfather's comparison |

## 5. Known weak spots, worst first

1. **Claude plan quotas.** Token budgets are not published; the dollar-value anchor is one
   blogger's measurement and the conversion to energy rests on another's logs. Treat the
   spread (roughly 7x between min and max) as the real answer.
2. **Grid water intensity.** 4.35 L/kWh is at the high end of published figures; USGS-based
   numbers are near 1.8. Water results could be ~2x too high.
3. **Driving miles.** Nobody measured the trips; they were converted from drive times at
   an assumed 30 mph.
4. **House averages.** RECS national averages stand in for an unknown house in an unknown
   climate with unknown heating fuel.
5. **Battery embodied carbon.** Published estimates range 40-150 kg CO2 per kWh of
   capacity; 75 was chosen as a midpoint and the service life is a guess.
6. **Market-based vs location-based carbon.** Data centers on clean power could be ~90%
   lower than shown (Hausfather); Google reports 0.03 g per Gemini prompt market-based
   versus roughly 0.08 g at the US-average grid.
7. **Golf, Walmart, restaurant figures** are per-facility averages derived from sector
   intensities, not measurements of any specific site.

## 6. Primary sources

- EIA: grid CO2 per kWh, RECS 2020 end uses, electricity sector totals
- EPA: gasoline and vehicle factors, WaterSense household water, ENERGY STAR
  Portfolio Manager source-to-site ratios
- IPCC AR5 / NREL: solar lifecycle emissions
- LBNL 2024 US data center report: electricity and water
- Argonne (via AAPG): water per gallon of oil produced and refined
- Google Cloud (2025): measured Gemini prompt energy, carbon, water
- Jegham et al. 2025, "How Hungry is AI?" (arXiv 2505.09598)
- Simon P. Couch (Jan 2026): electricity use of AI coding agents
- Zeke Hausfather, The Climate Brink (Aug 2026): real energy use of agentic AI
- Botfarm (2026): measured API-equivalent value of Claude Max weekly limits
- GCSAA, NACS, DTE/Energybox, DOE street lighting survey, Costs of War, Cambridge CBECI,
  Apple product environmental reports

Full links are in the "Sources" sections at the bottom of both HTML pages.
