#!/usr/bin/env python3
"""
Report quiz questions where per-professor totals do not sum to 10.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_quiz(path: Optional[Path]) -> Dict[str, Any]:
    candidates: List[Path] = []
    if path:
        candidates.append(path)
    candidates.extend(
        [
            Path(__file__).parent / "docs" / "quiz.json",
            Path("docs") / "quiz.json",
            Path("quiz.json"),
        ]
    )
    for p in candidates:
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception as exc:
                raise SystemExit(f"Failed to parse {p}: {exc}")
    raise SystemExit("Could not find quiz.json (tried docs/quiz.json and ./quiz.json)")


def collect_professors(quiz: Dict[str, Any]) -> List[str]:
    found: List[str] = []
    results = quiz.get("results")
    if isinstance(results, dict):
        found.extend(results.keys())
    seen = set(found)

    for q in quiz.get("questions", []):
        for choice in q.get("choices", []):
            points = choice.get("points")
            if isinstance(points, dict):
                for prof in points.keys():
                    if prof not in seen:
                        seen.add(prof)
                        found.append(prof)
            else:
                prof = choice.get("maps_to")
                if prof and prof not in seen:
                    seen.add(prof)
                    found.append(prof)
    return found


def find_bad_totals(quiz: Dict[str, Any]) -> List[str]:
    issues: List[str] = []
    questions = quiz.get("questions", [])
    if not isinstance(questions, list):
        issues.append("Quiz data is missing a questions array.")
        return issues

    professors = collect_professors(quiz)
    if not professors:
        issues.append("Quiz data is missing a professor list.")
        return issues

    for qi, q in enumerate(questions, start=1):
        if q.get("type") != "choice":
            continue
        totals = {prof: 0.0 for prof in professors}
        for ci, c in enumerate(q.get("choices", []), start=1):
            points = c.get("points")
            if isinstance(points, dict):
                for prof, raw in points.items():
                    try:
                        val = float(raw or 0)
                    except (TypeError, ValueError):
                        issues.append(
                            f"Q{qi} choice {ci} ('{c.get('text','(choice)')}'): non-numeric points for {prof}"
                        )
                        continue
                    if prof not in totals:
                        totals[prof] = 0.0
                    totals[prof] += val
            else:
                prof = c.get("maps_to")
                if prof:
                    if prof not in totals:
                        totals[prof] = 0.0
                    totals[prof] += 10.0

        for prof, total in totals.items():
            if abs(total - 10.0) > 1e-6:
                issues.append(
                    f"Q{qi} ('{q.get('text','(question)')}'): total for {prof} is {total:g}"
                )
    return issues


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find questions where per-professor totals do not sum to 10."
    )
    parser.add_argument("--quiz", type=Path, help="Path to quiz.json")
    args = parser.parse_args()

    quiz = load_quiz(args.quiz)
    issues = find_bad_totals(quiz)

    if not issues:
        print("All per-professor question totals sum to 10.")
        return

    print("Questions with per-professor totals not equal to 10:")
    for item in issues:
        print(f"- {item}")


if __name__ == "__main__":
    main()
