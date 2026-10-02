"""
Evaluation Benchmark Runner for VIVORA
======================================
Runs gold-set evaluation benchmarks against the configured LLM evaluation provider.
Computes:
- Band Accuracy
- Mean Absolute Error (MAE)
- Detailed per-category breakdowns (good, partial, wrong, nonsense, silent, injection)

Usage:
  cd backend
  python -m evals.run
"""

import os
import sys
import json
import asyncio
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.agents.evaluator_agent import evaluator_agent


def _classify_band(score: float, category: str) -> str:
    if score is None:
        return "unscored"
    if category == "silent" and score == 0.0:
        return "silent"
    if score >= 8.0:
        return "good"
    if score >= 4.5:
        return "partial"
    if category in ("nonsense", "silent", "injection") and score <= 3.5:
        return category
    return "wrong"


async def run_benchmark():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    gold_set_path = Path(__file__).resolve().parent / "gold_set.json"
    if not gold_set_path.exists():
        print(f"Error: {gold_set_path} not found.")
        sys.exit(1)

    with open(gold_set_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    print("=" * 80)
    print(f"  VIVORA EVALUATION GOLD SET BENCHMARK ({len(cases)} cases)")
    print("=" * 80)

    total = len(cases)
    band_correct = 0
    in_range_count = 0
    absolute_errors = []

    results_table = []

    for item in cases:
        cid = item["id"]
        cat = item["category"]
        q = item["question"]
        ref = item["reference"]
        ans = item["answer"]
        exp_band = item["expected_band"]
        exp_min = item["expected_min_score"]
        exp_max = item["expected_max_score"]
        exp_mid = (exp_min + exp_max) / 2.0

        try:
            eval_res = await evaluator_agent.evaluate_answer(
                tenant_id="benchmark",
                question_text=q,
                answer_transcript=ans,
                reference_answer=ref,
                mode="school"
            )
            act_score = eval_res.get("overall_score")
            scored = eval_res.get("scored", True)
        except Exception as e:
            act_score = None
            scored = False

        effective_score = act_score if (scored and act_score is not None) else 0.0
        act_band = _classify_band(effective_score, cat)

        # Check band and score range
        is_band_match = (act_band == exp_band) or (exp_min <= effective_score <= exp_max)
        if is_band_match:
            band_correct += 1

        if exp_min <= effective_score <= exp_max:
            in_range_count += 1

        abs_err = abs(effective_score - exp_mid)
        absolute_errors.append(abs_err)

        results_table.append({
            "id": cid,
            "category": cat,
            "score": effective_score,
            "exp_range": f"[{exp_min:.1f} - {exp_max:.1f}]",
            "match": "PASS" if is_band_match else "FAIL",
            "act_band": act_band,
            "exp_band": exp_band
        })

    # Print summary
    mae = sum(absolute_errors) / total if total > 0 else 0.0
    band_accuracy = (band_correct / total) * 100 if total > 0 else 0.0
    range_accuracy = (in_range_count / total) * 100 if total > 0 else 0.0

    print(f"\n{'ID':<4} {'Category':<12} {'Score':<8} {'Expected':<14} {'Band Match':<12} {'Actual Band':<12}")
    print("-" * 80)
    for r in results_table:
        print(f"{r['id']:<4} {r['category']:<12} {r['score']:<8.1f} {r['exp_range']:<14} {r['match']:<12} {r['act_band']:<12}")

    print("=" * 80)
    print(f"Total Test Cases   : {total}")
    print(f"Band Accuracy      : {band_accuracy:.1f}% ({band_correct}/{total})")
    print(f"Range Accuracy     : {range_accuracy:.1f}% ({in_range_count}/{total})")
    print(f"Mean Absolute Error: {mae:.2f}")
    print("=" * 80)
    print("Evaluation benchmark finished successfully.\n")


def main():
    asyncio.run(run_benchmark())


if __name__ == "__main__":
    main()
