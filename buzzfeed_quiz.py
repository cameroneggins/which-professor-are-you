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
import random
from typing import List, Dict, Any, Optional


QUIZ: Dict[str, Any] = {
	"title": "Which Professor Are You?",
	"description": "Answer a few fun questions and we'll match you to a professor.",
	"results": {
		"Benson Farb": "Calm, scholarly, and quietly brilliant.",
		"Matt Emerton": "Energetic, rigorous, and fond of exercise.",
		"Ewain Gwynne": "Laid-back, mysterious, and occasionally absent.",
		"Alex Eskin": "Curious, practical, and engaged with students.",
		"Amy Wilkinson": "Polished, organized, and people-minded.",
	},
	"questions": [
		{
			"text": "Are you politically correct?",
			"type": "choice",
			"choices": [
				{"text": "Always", "maps_to": "Amy Wilkinson"},
				{"text": "Mostly", "maps_to": "Benson Farb"},
				{"text": "Occasionally", "maps_to": "Alex Eskin"},
				{"text": "Never", "maps_to": "Matt Emerton"},
			],
		},
		{
			"text": "Do you prefer to respond to emails:",
			"type": "choice",
			"choices": [
				{"text": "Right now, at any time", "maps_to": "Matt Emerton"},
				{"text": "Within a day or two", "maps_to": "Benson Farb"},
				{"text": "I have literally never responded to an email?", "maps_to": "Ewain Gwynne"},
				{"text": "When pressed", "maps_to": "Alex Eskin"},
			],
		},
		{
			"text": "What is your Roman Empire?  (pull solutions from professors’ answers)",
			"type": "choice",
			"choices": [
				{"text": "Right now, at any time", "maps_to": "Matt Emerton"},
				{"text": "Within a day or two", "maps_to": "Benson Farb"},
				{"text": "I have literally never responded to an email?", "maps_to": "Ewain Gwynne"},
				{"text": "When pressed", "maps_to": "Alex Eskin"},
			],
		},
		{
			"text": "How many pullups can you do?",
			"type": "choice",
			"choices": [
				{"text": "0", "maps_to": "Ewain Gwynne"},
				{"text": "0<x<4", "maps_to": "Benson Farb"},
				{"text": "4<x<10", "maps_to": "Alex Eskin"},
				{"text": "10<x", "maps_to": "Amy Wilkinson"},
				{"text": "As many as Matt Emerton", "maps_to": "Matt Emerton"},
			],
		},
		{
			"text": "How often do you fall asleep during seminars or classes?",
			"type": "choice",
			"choices": [
				{"text": "Literally every time", "maps_to": "Ewain Gwynne"},
				{"text": "Whenever I am bored", "maps_to": "Alex Eskin"},
				{"text": "Rarely", "maps_to": "Benson Farb"},
				{"text": "Never", "maps_to": "Amy Wilkinson"},
			],
		},
		{
			"text": "Do you personally know any president?",
			"type": "choice",
			"choices": [
				{"text": "Yes", "maps_to": "Matt Emerton"},
				{"text": "No", "maps_to": "Benson Farb"},
			],
		},
		{
			"text": "How good is your handwriting?",
			"type": "choice",
			"choices": [
				{"text": "Anyone can read it", "maps_to": "Benson Farb"},
				{"text": "I can read it myself", "maps_to": "Matt Emerton"},
				{"text": "It is a safe encoding tool", "maps_to": "Ewain Gwynne"},
			],
		},
		{
			"text": "Do you think or ask AI first?",
			"type": "choice",
			"choices": [
				{"text": "Think", "maps_to": "Alex Eskin"},
				{"text": "AI", "maps_to": "Amy Wilkinson"},
			],
		},
		{
			"text": "How often do you update your website?",
			"type": "choice",
			"choices": [
				{"text": "Weekly", "maps_to": "Matt Emerton"},
				{"text": "Monthly", "maps_to": "Alex Eskin"},
				{"text": "Yearly", "maps_to": "Benson Farb"},
				{"text": "Never", "maps_to": "Ewain Gwynne"},
				{"text": "I will never make a website", "maps_to": "Amy Wilkinson"},
			],
		},
		{
			"text": "How long do you stay in your office?",
			"type": "choice",
			"choices": [
				{"text": "Until 3pm", "maps_to": "Benson Farb"},
				{"text": "Until 9pm", "maps_to": "Matt Emerton"},
				{"text": "Never", "maps_to": "Ewain Gwynne"},
			],
		},
	],
}


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

