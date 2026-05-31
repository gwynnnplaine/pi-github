<div align="center">

# pi-github

[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](./LICENSE)
[![Pi extension](https://img.shields.io/badge/pi-extension-111111?style=flat-square)](https://pi.dev)
[![GitHub](https://img.shields.io/badge/github-gwynnnplaine%2Fpi--github-111111?style=flat-square&logo=github)](https://github.com/gwynnnplaine/pi-github)

GitHub extension package for [Pi](https://pi.dev) with thread formatting, issue/PR listing, image extraction, and PR diff inspection.
</div>

> Fork of the archived [maria-rcks/pi-github](https://github.com/maria-rcks/pi-github), continued under [@gwynnnplaine](https://github.com/gwynnnplaine).

## Install

Use whichever source you prefer:

```bash
pi install npm:@gwynnnplaine/pi-github
# or
pi install git:github.com/gwynnnplaine/pi-github
# or
pi install /absolute/path/to/pi-github
```

## How it works

- This extension calls the GitHub CLI (`gh`) under the hood (`gh api ...`) to fetch issues, PRs, discussions, images, and diffs.
- `gh` must be installed and available in `PATH`.
- `gh` must be authenticated for the account you want to use (`gh auth login`).
- If you do not pass `owner`/`repo`, the tool tries to infer them from `git remote origin`.

## What this package does

- Formats issues, pull requests, and discussions into chronological markdown.
- Lists open issues and pull requests with pagination support.
- Extracts image references and downloads a selected image by ID.
- Lists PR changed files and fetches per-file diffs.
- Provides PR workflow helpers (overview, checks, commits, review comments, participants).
- Adds remote repository read/search utilities (file read, directory list, code/commit search, glob files).

## Tool actions

Tool name: `github`

- `format` (default)
  - optional filters: `author`, `kind`, `since`, `until`, `contains`
- `list_issues`
- `list_prs`
- `list_images`
- `download_image`
- `list_changes` (PR only)
- `get_change` (PR only)
- `list_participants`
- `list_review_comments` (PR only, supports `author`/`path`/`since`/`until` filters)
- `list_pr_commits` (PR only)
- `get_pr_commit` (PR only, requires `commitSha`)
- `list_pr_checks` (PR only)
- `pr_overview` (PR only, optional `includeFiles`/`includeReviews`/`includeChecks`)
- `read_file` (repo file content with optional `startLine`/`endLine`/`ref`)
- `list_directory` (repo directory entries with optional `ref`)
- `search_code` (repo code search with optional `path`)
- `glob_files` (repo tree glob filter with `filePattern`, optional `offset`/`limit`/`ref`)
- `search_commits` (repo commit search using `query` and optional `author`/`since`/`until`)

Core params:

- `owner`, `repo` (optional if `git remote origin` points to GitHub)
- `id` (alias: `number`)
- `entity`: `issue | pr | discussion` (optional, auto-detected)

## Links

- Repository: https://github.com/gwynnnplaine/pi-github
- Issues: https://github.com/gwynnnplaine/pi-github/issues
