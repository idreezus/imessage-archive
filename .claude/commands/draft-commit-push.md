# Draft Commit Push

## Description

Draft, review, and push git commit with approval

## Steps

1. **Analyze changes**
   - Run `git diff HEAD` to see working changes
   - Run `git log -1` to understand last commit context
2. **Draft commit message**
   - Format as conventional commit (type: description, body if needed)
   - Present the drafted message to user
   - NOTE: Do not say Claude author credits
3. **STOP - Wait for user approval**
   - **DO NOT PROCEED without explicit user confirmation**
   - Reply **YES** to stage, commit, and push with this message
   - Reply **NO** to cancel without making any changes
   - Reply **UPDATE: [your changes]** to revise the commit message
4. **Handle updates if requested**
   - If UPDATE was provided, revise the commit message
   - Return to step 3 and wait for approval again
5. **Execute git operations (ONLY after receiving YES)**
   - Run `git add .` to stage all changes
   - Run `git commit` with the approved message
   - Run `git push` to push to remote
   - Stop immediately if any command fails
