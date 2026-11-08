# Recording guide

You record the video. This project does not generate one.

1. On your own Mac, after `bash scripts/setup.sh`, start `npm run dev` and open `http://127.0.0.1:43123` on that Mac. Do not use the build machine’s address. A phone-width check from the Linux run is `08-quote-mobile.png`. The Mac path itself has not been executed.
2. Click **Start over** if a previous session is on screen.
3. Follow `docs/DEMO_SCRIPT.md`. Stay under 3 minutes.
4. Keep the simulation pill in frame at the start.
5. Do not open the raw `data/` CSVs on camera if the GSTIN would be readable in a list. The product masks it on the tracker and the handoff.
6. Do not upload a real document. The buttons run OCR on the supplied PNG specimens.
7. Do not type the review-desk key on camera. The page does not show it. A human exception, if you record one at all, belongs off camera. The key lives only in `.env.local` on the machine that started the app, and the desk refuses requests when that variable is missing.
8. Host the video yourself and put the link in the deck. The deck limit you set is an introduction plus 7 content slides, 8 slides total, at most 20 MB. A hyperlink is allowed. Do not embed the video file in the PPT if that would blow the limit.
9. The official case PDF and the organiser template are not in this repo. Do not attach them to a public page.

Suggested slide map, for when the deck is updated separately:

1. Introduction (not one of the seven).
2. Funnel and who to serve first, from `docs/EVALUATION.md`.
3. Bundle, price floor, and the dependency block.
4. Working journey. The public URL is not deployed. Record on the Mac that is running the app, or leave the hyperlink blank until a host is approved.
5. Architecture and the privacy note.
6. Competitive position, only with sources you re-check. This prototype does not add new competitor claims.
7. Unit economics that this run computed, labelled as observed or as a target.
8. Rollout and the partner handoff. Still untested: Mac execution and any public deployment. Still unbuilt: live payment, provisioning, and government lookups. The Linux advisor model is built.
