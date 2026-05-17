#!/usr/bin/env python3
"""
Summarize quiz questions and per-professor point assignments.
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
    found: List[str] = list(quiz.get("results", {}).keys())
    seen = set(found)
    for q in quiz.get("questions", []):
        for choice in q.get("choices", []):
            if "points" in choice:
                for prof in choice.get("points", {}).keys():
                    if prof not in seen:
                        seen.add(prof)
                        found.append(prof)
            elif "maps_to" in choice:
                prof = choice.get("maps_to")
                if prof and prof not in seen:
                    seen.add(prof)
                    found.append(prof)
    return found


def summarize_question(q: Dict[str, Any], professors: List[str]) -> Dict[str, Dict[str, Any]]:
    summary = {prof: {"total": 0.0, "answers": []} for prof in professors}
    choices = q.get("choices", [])
    for choice in choices:
        choice_text = str(choice.get("text", "(choice)"))
        if "points" in choice:
            points = choice.get("points", {})
            for prof in professors:
                val = float(points.get(prof, 0))
                if val != 0:
                    summary[prof]["answers"].append(f"{choice_text} ({val:g})")
                summary[prof]["total"] += val
        elif "maps_to" in choice:
            prof = choice.get("maps_to")
            if prof is None:
                continue
            if prof not in summary:
                summary[prof] = {"total": 0.0, "answers": []}
            summary[prof]["total"] += 10.0
            summary[prof]["answers"].append(f"{choice_text} (10)")
    return summary


def format_question_summary(index: int, q: Dict[str, Any], summary: Dict[str, Dict[str, Any]], professors: List[str]) -> None:
    q_text = q.get("text", f"Question {index}")
    print(f"{index}. {q_text}")
    if q.get("type") and q.get("type") != "choice":
        print("   (non-choice question; no scoring)")
        print("")
        return

    for prof in professors:
        data = summary.get(prof, {"total": 0.0, "answers": []})
        total = data.get("total", 0.0)
        answers = data.get("answers", [])
        answers_str = "; ".join(answers) if answers else "none"
        print(f"   - {prof}: total {total:g}; answers: {answers_str}")
    print("")


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize quiz question scoring.")
    parser.add_argument("--quiz", type=Path, help="Path to quiz.json")
    args = parser.parse_args()

    quiz = load_quiz(args.quiz)
    professors = collect_professors(quiz)

    for i, q in enumerate(quiz.get("questions", []), start=1):
        summary = summarize_question(q, professors)
        format_question_summary(i, q, summary, professors)


if __name__ == "__main__":
    main()
