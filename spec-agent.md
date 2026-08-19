---
description: Reconcile macro-mate-spec.md against current Linear issue state and propose spec updates
---

# Spec Reconciliation Agent

Run this manually (not scheduled) whenever you want to check whether `macro-mate-spec.md` has drifted from what's actually happening in Linear. This does NOT edit the spec — it only proposes changes for you to accept, reject, or edit.

## Procedure

1. **Read the spec.** Load `macro-mate-spec.md` from the repo root in full.

2. **Read the correction log, if it exists.** Load `corrections.md` from the repo root. This contains past proposals and how they were resolved (accepted / rejected / edited, with notes on why). Use it to calibrate this run:
   - If a similar proposal was rejected before, don't just repeat it — factor in the stated reason.
   - If a similar edit was made before, apply the same judgment this time.

3. **Pull current Linear state.** Using the Linear MCP tools:
   - `list_issues` for the "Macro Mate" team (all states, not just active — completed/canceled issues can resolve open questions too)
   - `list_comments` on any issue whose description alone doesn't make its current status clear
   Read full issue descriptions, not just titles — the drift is usually in the description, not the title.

4. **Compare section by section.** Walk the spec's sections in order and check each against Linear:
   - **Current scope — what's built**: any Linear activity suggesting this list is missing something now actually built, or something listed is no longer accurate?
   - **In progress**: for each item, does Linear show it further along (or further behind) than the spec's stated status? A status like "WIP, not functional yet" is a claim — check whether Linear evidence (shipped eval suites, working demos, real usage data) contradicts it.
   - **Not yet started**: has any Linear issue started scoping or building this?
   - **Explicit non-goals**: has any Linear issue proposed something that crosses a stated non-goal? Check especially for the conditions the spec itself named as reasons to revisit (e.g. "revisit if X becomes the main friction point") — has Linear activity said that condition is now true?
   - **Key decisions log**: any Linear issue that reads as a decision but isn't reflected here yet?
   - **Open questions**: has Linear activity — directly or by implication (e.g. relative priority shown by status/priority fields, or an issue whose content directly answers the question) — effectively answered any of these?

5. **Produce a proposed diff.** For each drift point found, output:
   - **Section**: which part of the spec it affects
   - **Current spec text**: quote it
   - **Proposed change**: the specific replacement text
   - **Evidence**: which Linear issue(s) (with ID) support this, quoting the relevant part
   - **Confidence**: high / medium / low — low if the Linear evidence is suggestive but not conclusive

   Group proposals into: **contradictions** (spec states something Linear evidence disputes), **resolved open questions**, **newly relevant items** (real Linear activity with no home in the spec at all).

6. **Do not write to the spec.** Present the full proposed diff in chat and stop. Wait for a decision on each item.

7. **After the user responds**, append one entry per accepted/rejected/edited proposal to `corrections.md` in the format:

   ```markdown
   ## YYYY-MM-DD
   - Proposed: [what was suggested]
   - Decision: accepted / rejected / edited
   - Note: [why, if rejected or edited]
   ```

   Only after logging corrections should you actually edit `macro-mate-spec.md` — and only for the items marked accepted or edited (using the edited version).

## Notes

- This is a personal single-user project — don't over-formalize. A proposal can be one sentence if that's all the drift warrants.
- Silence in Linear is not evidence of anything — absence of activity on a spec item isn't drift, it's just no news.
- Prefer high-confidence, concrete proposals over speculative ones. If evidence is ambiguous, say so and mark it low confidence rather than forcing a call.
