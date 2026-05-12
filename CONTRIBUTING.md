# Contributing Guidelines

To keep the project history clean and workflows simple, follow these rules for all code changes:

## 1. Create a Pull Request (PR) for All Changes
- Always create a new branch for any feature, fix, or experiment.
- Push your branch and open a PR on GitHub.
- All reviews, merges, and history are managed through PRs.
- The `main` branch is only updated via PR merges (never direct pushes).

## 2. Update an Existing Branch (for an Open PR)
- To update a PR, push new commits to the same branch.
- Do **not** rebase or force-push unless you are the only one working on the branch and understand the risks.
- If you must rebase, communicate with collaborators first.

## 3. Protected Branches
- Direct pushes to `main` are not allowed.
- Force-pushes to `main` are not allowed.
- All changes to `main` must go through PRs.

## 4. Summary Table

| Action                | Allowed? | How?                        |
|-----------------------|----------|-----------------------------|
| Create PR             | Yes      | New branch → PR             |
| Update PR             | Yes      | Push to PR branch           |
| Push to main          | No       | Use PR merge only           |
| Force-push to main    | No       | Never                       |
| Rebase shared branch  | No*      | Only if solo, then force-push|

\* Only rebase and force-push if you are the only one working on the branch and you know the consequences.

## 5. General Tips
- Keep PRs focused and small when possible.
- Write clear commit messages and PR descriptions.
- Review and test your code before requesting a merge.

---

By following these guidelines, we keep the project history clean, avoid merge headaches, and make collaboration easy for everyone.
