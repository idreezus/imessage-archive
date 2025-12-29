# Rename Current Git Branch

## Description

Rename current branch and update the remote repository

## Steps

1. **Get new branch name from user**
   - Run `git branch --show-current` to get current branch name
   - Ask user: "What do you want to rename your current branch to? The current name is `<current-branch-name>`"
   - Wait for user response
2. **Verify state and rename local branch**
   - Run `git branch -r | grep <old-name>` to verify remote exists
   - **STOP if no remote branch found**
   - Run `git branch -m <new-branch-name>`
   - **STOP if command fails**
   - Run `git branch --show-current` to verify
   - **STOP if result doesn't match new name**
3. **Push new branch and set upstream**
   - Run `git push origin HEAD:<new-branch-name>`
   - **STOP if command fails or shows fatal errors**
   - Run `git push --set-upstream origin <new-branch-name>`
   - **STOP if command fails**
   - Run `git branch -vv | grep "* <new-branch-name>"`
   - **STOP if upstream doesn't show `[origin/<new-branch-name>]`**
4. **Ask about deleting old remote branch**
   - Ask user: "Do you want to delete the old remote branch `<old-branch-name>`? (yes/no)"
   - If no: Display "Branch renamed from `<old-name>` to `<new-name>`. Old remote branch preserved."
   - If yes: Proceed to step 5

5. **Delete old remote branch**
   - Run `git push origin --delete <old-branch-name>`
   - **STOP if command fails**
   - Run `git branch -r | grep <old-name>`
   - **STOP if old branch still exists**
   - Display: "Branch renamed from `<old-name>` to `<new-name>`. Old remote branch deleted"
