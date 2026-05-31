<div align="center">

<img src="https://raw.githubusercontent.com/gwynnnplaine/pi-github/main/assets/banner.png" alt="@gwynnnplaine/pi-github" width="100%">

[![License](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](./LICENSE)
[![Pi extension](https://img.shields.io/badge/pi-extension-111111?style=flat-square)](https://pi.dev)
[![npm](https://img.shields.io/npm/v/@gwynnnplaine/pi-github?style=flat-square&color=111111&logo=npm)](https://www.npmjs.com/package/@gwynnnplaine/pi-github)
[![GitHub](https://img.shields.io/badge/github-gwynnnplaine%2Fpi--github-111111?style=flat-square&logo=github)](https://github.com/gwynnnplaine/pi-github)

</div>

> Fork of the archived [maria-rcks/pi-github](https://github.com/maria-rcks/pi-github), continued under [@gwynnnplaine](https://github.com/gwynnnplaine).

**A simple, reliable GitHub tool for your agents.** Wraps the `gh` CLI you already have.

- **Markdown-formatted** output. LLMs read it far better than raw JSON.
- **Infers the repo** from `git remote origin`, so neither you nor the agent fusses with `owner`/`repo`.
- **Handles pictures** — lists and downloads image attachments from issues and PRs.

Just tell Pi `review #1234` and it works.

## Install

```bash
pi install npm:@gwynnnplaine/pi-github
# or
pi install git:github.com/gwynnnplaine/pi-github
# or
pi install /absolute/path/to/pi-github
```

## Requires `gh`

- Install `gh` and put it on `PATH`.
- Authenticate once: `gh auth login`.
- Skip `owner`/`repo`. They're inferred from `git remote origin`.

## Use

Ask Pi in plain language. It routes to the `github` tool.

```
"review #1234"
"list open PRs"
"PR overview for 88 — files, reviews, checks"
"show the diff for src/index.ts in PR 88"
"read src/index.ts from main"
"search the repo for 'fetchThread'"
```

Pass `owner`/`repo` to target another repo; omit them to use the current one.

## Actions

One tool, `github`. Pick an `action` — default is `format`.

| Action | Does | Scope |
|--------|------|-------|
| `format` | Thread → chronological markdown. Filters: `author`, `kind`, `since`, `until`, `contains` | issue / PR / discussion |
| `list_issues` | Open issues, paginated | repo |
| `list_prs` | Open PRs, paginated | repo |
| `list_images` | Image references in a thread | thread |
| `download_image` | Download one image by `imageId` | thread |
| `list_changes` | Changed files + change IDs | PR |
| `get_change` | One file's diff by `changeId` | PR |
| `list_participants` | Everyone who touched the thread | thread |
| `list_review_comments` | Review comments. Filters: `author`, `path`, `since`, `until` | PR |
| `list_pr_commits` | Commits in the PR | PR |
| `get_pr_commit` | One commit's diff by `commitSha` | PR |
| `list_pr_checks` | CI / check status | PR |
| `pr_overview` | Summary: files + reviews + checks. Toggle with `includeFiles`/`includeReviews`/`includeChecks` | PR |
| `read_file` | Remote file content. Options: `startLine`, `endLine`, `ref` | repo |
| `list_directory` | Remote directory listing. Option: `ref` | repo |
| `search_code` | Code search. Option: `path` | repo |
| `glob_files` | Match the repo tree by `filePattern`. Options: `offset`, `limit`, `ref` | repo |
| `search_commits` | Commit history search by `query`, `author`, `since`, `until` | repo |

## Params

- `owner`, `repo` — optional; inferred from `git remote origin`.
- `id` — thread number (issue / PR / discussion). Legacy alias `number` still works.
- `entity` — `issue | pr | discussion`. Auto-detected when omitted.

## Links

- Repository: https://github.com/gwynnnplaine/pi-github
- Issues: https://github.com/gwynnnplaine/pi-github/issues
