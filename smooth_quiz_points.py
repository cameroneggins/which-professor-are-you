#!/usr/bin/env python3
"""
Smooth quiz points for spectrum questions.

Rule:
- Choose each professor's peak choice (highest points; leftmost on ties).
- Apply adjacent-only smoothing:
  - 2 choices: 7/3 split toward the peak.
  - 3+ choices: endpoints use 7/3, middle uses 6/2/2 for neighbors.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


TARGET_QUESTIONS = {
    "Are you politically correct?",
    "Do you prefer to respond to emails:",
    "How many pullups can you do?",
    "When do you arrive to seminars?",
    "How often do you fall asleep during seminars or classes?",
    "How good is your handwriting?",
    "How often do you update your website?",
}


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


def collect_professors_for_question(question: Dict[str, Any]) -> List[str]:
    seen = set()
    order: List[str] = []
    for choice in question.get("choices", []):
        points = choice.get("points")
        if not isinstance(points, dict):
            continue
        for prof in points.keys():
            if prof not in seen:
                seen.add(prof)
                order.append(prof)
    return order


def pick_peak(values: List[float]) -> Optional[int]:
    if not values:
        return None
    max_val = max(values)
    if max_val == 0:
        return None
    for idx, val in enumerate(values):
        if val == max_val:
            return idx
    return None


def smooth_values(choice_count: int, peak_index: int) -> List[int]:
    result = [0 for _ in range(choice_count)]
    if choice_count == 1:
        result[0] = 10
        return result
    if choice_count == 2:
        if peak_index == 0:
            return [7, 3]
        return [3, 7]

    if peak_index <= 0:
        result[0] = 7
        result[1] = 3
        return result
    if peak_index >= choice_count - 1:
        result[-2] = 3
        result[-1] = 7
        return result

    result[peak_index - 1] = 2
    result[peak_index] = 6
    result[peak_index + 1] = 2
    return result


def smooth_question(question: Dict[str, Any]) -> Tuple[int, List[str]]:
    choices = question.get("choices", [])
    professors = collect_professors_for_question(question)
    if not choices or not professors:
        return 0, []

    original: Dict[str, List[float]] = {}
    for prof in professors:
        values: List[float] = []
        for choice in choices:
            points = choice.get("points")
            if not isinstance(points, dict):
                values.append(0)
                continue
            raw = points.get(prof, 0)
            try:
                values.append(float(raw or 0))
            except (TypeError, ValueError):
                values.append(0)
        original[prof] = values

    warnings: List[str] = []
    updates = 0
    for prof, values in original.items():
        peak = pick_peak(values)
        if peak is None:
            warnings.append(f"No peak found for {prof} in '{question.get('text')}'")
            continue
        smoothed = smooth_values(len(choices), peak)
        for idx, choice in enumerate(choices):
            points = choice.get("points")
            if not isinstance(points, dict):
                continue
            points[prof] = smoothed[idx]
        updates += 1

    return updates, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Smooth quiz points for spectrum questions.")
    parser.add_argument("--quiz", type=Path, help="Path to quiz.json")
    args = parser.parse_args()

    quiz = load_quiz(args.quiz)
    questions = quiz.get("questions", [])
    if not isinstance(questions, list):
        raise SystemExit("Quiz data has no questions array.")

    total_updates = 0
    all_warnings: List[str] = []
    for q in questions:
        if q.get("type") != "choice":
            continue
        if q.get("text") not in TARGET_QUESTIONS:
            continue
        updates, warnings = smooth_question(q)
        total_updates += updates
        all_warnings.extend(warnings)

    out_path = args.quiz or (Path(__file__).parent / "docs" / "quiz.json")
    out_path.write_text(json.dumps(quiz, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Smoothed {total_updates} professor distributions.")
    if all_warnings:
        print("Warnings:")
        for item in all_warnings:
            print(f"- {item}")


if __name__ == "__main__":
    main()
