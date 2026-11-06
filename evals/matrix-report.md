# Model matrix: lead / worker combinations

Run: `evals/runs/matrix-full` · profiles per combo: opus-sonnet 18, sonnet-sonnet 18, sonnet-haiku 18 · grader: claude-opus-5-5 (same for every combo)

Lead = orchestrator, eligibility judge, ranker. Workers = intake and the 5 finders. Effort levels are the same in every combo.

## Quality

| Combo | Recall | Gray kept | Wrong excl. | Must-not | Invented | Working links | Reentry-specific recs | Schema repairs | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| opus-sonnet | 99% | 97% | 1 | 8 | 0 | 92% | 30% | 0 | 0 |
| sonnet-sonnet | 99% | 100% | 1 | 5 | 0 | 92% | 33% | 0 | 0 |
| sonnet-haiku | 99% | 94% | 1 | 4 | 0 | 89% | 36% | 0 | 0 |

## Alumni-facing steps (the `for_alumnus` text)

| Combo | Steps | Reading grade (FK) | Third-person leaks | Staff-only leaks | Missing |
| --- | --- | --- | --- | --- | --- |
| opus-sonnet | 54 | 5.5 | 0 | 0 | 0 |
| sonnet-sonnet | 54 | 5.2 | 0 | 0 | 0 |
| sonnet-haiku | 54 | 5.4 | 0 | 0 | 0 |

## Speed

| Combo | p50 s | p90 s | max s |
| --- | --- | --- | --- |
| opus-sonnet | 97 | 109 | 109 |
| sonnet-sonnet | 78 | 92 | 94 |
| sonnet-haiku | 67 | 96 | 160 |

## Cost per plan

| Combo | $ / plan | Input | Cache write | Cache read | Output | Web search | Lead $ | Workers $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| opus-sonnet | **$1.83** | $1.28 | $0.000 | $0.000 | $0.326 | $0.227 | $0.417 | $1.41 |
| sonnet-sonnet | **$1.67** | $1.22 | $0.000 | $0.000 | $0.221 | $0.234 | $0.246 | $1.43 |
| sonnet-haiku | **$0.644** | $0.340 | $0.000 | $0.000 | $0.110 | $0.193 | $0.254 | $0.390 |

## Demo cost (optimized prompt caching assumed at 50% of the uncached cost)

Measured with caching on opus-sonnet: $1.59 → $0.84 per plan (−47.5%; about −42% for a plan running alone). The demo figures below apply 50% to every combo. The resource finder runs once a month (12 plans a year per returner).

| Combo | $ / plan (uncached) | **$ / plan (cached)** | **Per returner per year** | 1,000 returners per year |
| --- | --- | --- | --- | --- |
| opus-sonnet | $1.83 | **$0.916** | **$10.99** | $10,990 |
| sonnet-sonnet | $1.67 | **$0.836** | **$10.03** | $10,032 |
| sonnet-haiku | $0.644 | **$0.322** | **$3.86** | $3,864 |

## Tokens per plan

| Combo | API calls | Input (uncached) | Cache write | Cache read | Output | Web searches | Web fetches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| opus-sonnet | 18 | 579,269 | 0 | 0 | 23,813 | 22.7 | 2.7 |
| sonnet-sonnet | 20 | 608,408 | 0 | 0 | 22,138 | 23.4 | 3.4 |
| sonnet-haiku | 20 | 619,938 | 0 | 0 | 37,208 | 19.3 | 4.1 |

## Cost and tokens by agent (per plan)

| Combo | intake | orchestrator | finders | eligibility | ranker |
| --- | --- | --- | --- | --- | --- |
| opus-sonnet | — | $0.028 · 1K in / 1.2K out | $1.41 · 519K in / 15.0K out | $0.287 · 49K in / 4.5K out | $0.101 · 10K in / 3.1K out |
| sonnet-sonnet | — | $0.016 · 1K in / 1.4K out | $1.43 · 519K in / 15.4K out | $0.192 · 78K in / 3.6K out | $0.038 · 10K in / 1.8K out |
| sonnet-haiku | — | $0.016 · 1K in / 1.4K out | $0.390 · 527K in / 30.3K out | $0.197 · 80K in / 3.7K out | $0.041 · 11K in / 1.8K out |

## Against the current setup (opus-sonnet)

| Combo | Cost vs baseline | Recall vs baseline | Gray kept vs baseline | Speed (p50) vs baseline | Recall points per $ |
| --- | --- | --- | --- | --- | --- |
| opus-sonnet | 1.00× | +0 pts | +0 pts | +0 s | 54 |
| sonnet-sonnet | 0.91× | +1 pts | +3 pts | -19 s | 59 |
| sonnet-haiku | 0.35× | +1 pts | -3 pts | -30 s | 154 |

## Notes

- Prices: platform.claude.com pricing page, Nov 6, 2026 (`evals/pricing.py`). Web search $10 per 1,000; web fetch is tokens only; cache writes at the 5-minute rate.
- Haiku 5.5's tokenizer counts about 30% more tokens for the same text, so its token counts aren't directly comparable.
- Grader cost (Opus 5.5, same for every combo) is excluded from $ / plan: opus-sonnet $0.466, sonnet-sonnet $0.471, sonnet-haiku $0.546.
