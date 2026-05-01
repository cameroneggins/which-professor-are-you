#!/usr/bin/env python3
"""
Which Professor Are You? - simple BuzzFeed-style quiz runner

Run interactively:
  python3 buzzfeed_quiz.py

Run a quick auto-demo (no prompts):
  python3 buzzfeed_quiz.py --auto

The quiz data below is intentionally simple JSON-like structures so you can
adapt it for a web frontend or GitHub Pages later.
"""
from __future__ import annotations
import argparse
import json
import random
from pathlib import Path
from typing import List, Dict, Any, Optional


def _load_quiz_from_json() -> Dict[str, Any]:
    candidates = [
        Path(__file__).parent / "docs" / "quiz.json",
        Path("docs") / "quiz.json",
        Path("quiz.json"),
    ]
    for p in candidates:
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception as e:
                raise SystemExit(f"Failed to parse {p}: {e}")
    raise SystemExit("Could not find a quiz JSON file. Please add docs/quiz.json")


QUIZ: Dict[str, Any] = _load_quiz_from_json()


def ask_choice(q: Dict[str, Any]) -> str:
	choices = q["choices"]
	print(q["text"])
	for i, c in enumerate(choices, start=1):
		print(f"  {i}. {c['text']}")
	while True:
		val = input(f"Choose 1-{len(choices)}: ").strip()
		if not val:
			print("Please enter a choice number.")
			continue
		if not val.isdigit():
			print("Please enter a number.")
			continue
		idx = int(val)
		if 1 <= idx <= len(choices):
			return choices[idx - 1]["maps_to"]
		print("Out of range; try again.")


def ask_text(q: Dict[str, Any]) -> str:
	print(q["text"])
	return input("Your answer: ").strip()


def run_quiz(auto: bool = False, demo_random: bool = False) -> None:
	print("\n", QUIZ["title"], "\n", QUIZ["description"], "\n")

	scores: Dict[str, int] = {name: 0 for name in QUIZ["results"].keys()}
	answer_order: List[str] = []
	free_text_answers: Dict[str, str] = {}

	for q in QUIZ["questions"]:
		if q.get("type") == "choice":
			if auto:
				if demo_random:
					choice = random.choice(q["choices"])["maps_to"]
				else:
					# deterministic: pick middle choice (or first if even)
					idx = len(q["choices"]) // 2
					choice = q["choices"][idx]["maps_to"]
				print(f"Q: {q['text']} -> Auto-choice: {choice}")
			else:
				choice = ask_choice(q)
			scores[choice] = scores.get(choice, 0) + 1
			answer_order.append(choice)
		elif q.get("type") == "text":
			if auto:
				sample = "(auto-demo answer)"
				print(f"Q: {q['text']} -> {sample}")
				free_text_answers[q["text"]] = sample
			else:
				free_text_answers[q["text"]] = ask_text(q)
		else:
			# unknown question type
			continue

	# Determine winner(s)
	max_score = max(scores.values()) if scores else 0
	tied = [name for name, s in scores.items() if s == max_score]

	if len(tied) == 1:
		winner = tied[0]
	else:
		# tie-breaker: last-chosen preference wins
		winner = None
		for name in reversed(answer_order):
			if name in tied:
				winner = name
				break
		if winner is None:
			winner = tied[0]

	print("\n--- RESULT ---")
	print(f"You are: {winner}")
	print(QUIZ["results"].get(winner, ""))

	if free_text_answers:
		print("\nYour text answers:")
		for qtext, ans in free_text_answers.items():
			print(f" - {qtext}: {ans}")


def main() -> None:
	parser = argparse.ArgumentParser(description="Run the quiz")
	parser.add_argument("--auto", action="store_true", help="Run with deterministic auto-choices")
	parser.add_argument("--random", action="store_true", help="Run with random auto-choices")
	args = parser.parse_args()

	run_quiz(auto=args.auto or args.random, demo_random=args.random)


if __name__ == "__main__":
	main()

