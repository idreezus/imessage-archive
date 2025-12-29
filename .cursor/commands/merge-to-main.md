# Merge to Main

## Description

Merge current feature branch to main with squash or regular merge

## Steps

1. **Pre-merge validation**
   - Check for uncommitted changes: `git status --porcelain` → **STOP** if any found
   - Run build/typecheck: `npm run build` → **STOP** if fails
   - Get current branch: `git branch --show-current` → **STOP** if already on main

2. **Create backup branch**
   - Create timestamped backup: `git branch backup/<feature-branch>-$(date +%Y%m%d-%H%M%S)` → **STOP** if fails
   - Store backup branch name

3. **Choose merge strategy**
   - Ask: "Squash or regular merge? (squash/regular)" → **STOP** if invalid response

4. **Analyze branch changes**
   - View commits: `git log main..<feature-branch>`
   - View diff: `git diff main...<feature-branch>` and `--stat`
   - Analyze commit messages, files, and changes to understand full scope

5. **Update main branch**
   - Switch: `git switch main` → **STOP** if fails
   - Update: `git pull` → **STOP** if fails

6. **Draft merge commit message**
   - Write message summarizing branch work based on step 4 analysis
   - Present to user

7. **Wait for user approval**
   - **YES** → proceed to step 9
   - **NO** → cancel and return to feature branch
   - **UPDATE: [changes]** → revise message, return to this step

8. **Execute merge** (only after YES)
   - Squash: `git merge --squash <feature-branch>` then `git commit -m "<message>"`
   - Regular: `git merge <feature-branch> -m "<message>"`
   - **STOP** if merge fails (show conflict instructions and backup branch)
   - Push: `git push` → **STOP** if fails

9. **Branch cleanup**
   - Ask: "Delete feature branch? (local-only/both/no)" → execute accordingly
   - Ask: "Delete backup branch? (yes/no)" → execute or display preservation message
   - Display success confirmation
