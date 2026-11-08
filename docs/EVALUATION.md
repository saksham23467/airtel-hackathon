# Recommender evaluation

Trained by `python3 model/train.py` on this machine. The corrected v3 `recommender.py` and `ranker_offline.joblib` were not in the handoff. `LEGACY_NOT_CORRECTED_recommender.py` was not used. This file reports this run.

Protocol: 5-fold lead-level CV, shuffle seed 7, on 368 activated leads. Every method uses the same eligibility filter and the same dependency assembler. Eligibility is city tier, employees, sites, and an **active** mock GSTIN when the catalogue sets `requires_gstin`. A product whose bases are all ineligible is not scored. Top-3 and top-5 bundles are assembled separately. Precision keeps the original purchase labels, including purchases that break the rules. Python 3.12.3, scikit-learn 1.9.1, numpy 2.5.4. The historical log recorded Python 3.13.5 with the same library versions.

## This run

| Method | Assembled P@3 | Assembled P@5 | Raw top-5 before assembly |
| --- | --- | --- | --- |
| Gradient boosting | 0.7074 | 0.5647 | 0.5674 |
| Segment popularity | 0.6839 | 0.5783 | 0.5788 |
| Global popularity | 0.4819 | 0.4478 | 0.4478 |
| Stated interest | 0.3723 | 0.4109 | 0.4098 |

Assembled bundles had **0** dependency or eligibility violations. Mean size is exactly 3 and exactly 5. GBM recall@3 is 0.5179 and hit-rate@3 is 1.0.

Paired bootstrap, 2000 resamples, GBM minus segment popularity at Precision@3: delta **0.0236**, 95% interval **0.0027 to 0.0435**. The interval does not include zero. GBM does not beat segment popularity at Precision@5 (0.5647 versus 0.5783). Say that out loud if a slide claims the model wins at every cutoff.

These assembled precision figures match the historical log to the printed digits. That is a result of this reimplementation. The missing v3 ranker joblib was not loaded. This sentence is about the catalogue ranker only. The advisor model is a separate program and, on the current Linux run, did load. The raw-versus-assembled gap is the dependency assembler changing the set. Ranking and closure are different steps.

## Purchase audit on the 1,651 activated lines

| Check | Lines |
| --- | --- |
| Profile failure (tier, employees, sites, or missing GSTIN flag) | 40 |
| Same-bundle dependency failure, profile otherwise ok | 9 |
| Union of those two | 49 |
| Additional GST-required lines whose mock GSTIN is not Active | 9 |

## Funnel, computed from `smb_leads.csv`

5,000 → 3,406 contacted → 1,974 needs assessed → 861 quote accepted → 588 KYC complete → 368 activated.

Mean 17.62 days and 3.01 follow-up calls on the 368. Median monthly bundle ₹6,900. Blended acquisition cost ₹15,053 (₹55,39,640 of recorded spend divided by 368). The mean cost stored on activated rows alone is ₹5,385; that is not the blended figure. Six-month churn 56/368 = 15.2%. Activation with a GSTIN flag 338/3,534 versus 30/1,466 without.

Segment activation: micro 110/2,709, offices 138/1,247, multi-site 83/755, manufacturing 37/289. Revenue-months in the evidence desk divide cost by mean bundle. Contribution margin is not in the file, so this is not profit payback.

## Limits

Training sees only businesses that activated, so it learns what converters bought. Scores on those same leads from the saved full-data model are in-sample; Blue Lotus is labelled that way. Quantities are not predicted. The catalogue is fixed. Registry calls are local files.
