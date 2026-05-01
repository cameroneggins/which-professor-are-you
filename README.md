# Which Professor Are You?

A small BuzzFeed-style quiz implemented in Python. Answers map to one of five professors.

**Files**
- `buzzfeed_quiz.py`: Quiz data + interactive runner.

**Run locally**

Interactive mode:

```bash
python3 buzzfeed_quiz.py
```

Deterministic auto-demo (no prompts):

```bash
python3 buzzfeed_quiz.py --auto
```

Random auto-demo:

```bash
python3 buzzfeed_quiz.py --random
```

**Sample output (from `--auto`)**

```
 Which Professor Are You? 
 Answer a few fun questions and we'll match you to a professor. 

Q: Are you politically correct? -> Auto-choice: Alex Eskin
Q: Do you prefer to respond to emails: -> Auto-choice: Ewain Gwynne
Q: What is your Roman Empire?  (pull solutions from professors’ answers) -> (auto-demo answer)
Q: How many pullups can you do? -> Auto-choice: Alex Eskin
Q: How often do you fall asleep during seminars or classes? -> Auto-choice: Benson Farb
Q: Do you personally know any president? -> Auto-choice: Benson Farb
Q: How good is your handwriting? -> Auto-choice: Matt Emerton
Q: Do you think or ask AI first? -> Auto-choice: Amy Wilkinson
Q: How often do you update your website? -> Auto-choice: Benson Farb
Q: How long do you stay in your office? -> Auto-choice: Matt Emerton

--- RESULT ---
You are: Benson Farb
Calm, scholarly, and quietly brilliant.

Your text answers:
 - What is your Roman Empire?  (pull solutions from professors’ answers): (auto-demo answer)
```

**Push to GitHub**

To create a new GitHub repo and push the code (option A uses `gh` CLI):

```bash
# initialize repo locally (if not already a git repo)
git init
git add .
git commit -m "Add Which Professor Are You? quiz"

# create repo on GitHub and push (requires GitHub CLI `gh`)
# replace <repo-name> with your desired repo name
gh repo create <repo-name> --public --source=. --remote=origin --push
```

Option B (manual remote creation):

```bash
# create repo on github.com via UI, then:
git remote add origin https://github.com/your-username/<repo-name>.git
git branch -M main
git push -u origin main
```

**Next steps I can do for you**
- Create the remote GitHub repo for you (requires `gh` auth on your machine). 
- Add a tiny HTML demo frontend and GitHub Pages config.

If you want me to create the remote repo now, say yes and confirm you have `gh` installed and authenticated, or provide preferred remote URL.
