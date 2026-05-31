import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { basename, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { GithubParams } from "./schema";
import type { Action, Entity } from "./types";
import { ThreadCache } from "./cache/thread-cache";
import { createGitHubClient } from "./github/client";
import { fetchPrChanges, fetchPrCommitDetail, fetchPrCommits, fetchPrChecks, fetchPrOverview, fetchRepoDirectory, fetchRepoFile, fetchRepoTreeFiles, fetchReviewComments, fetchThread, searchRepoCode, searchRepoCommits } from "./github/fetchers";
import { inferEntity, resolveRepo } from "./github/repo";
import { renderThreadMarkdown } from "./renderers/thread";
import {
	renderChangeMarkdown,
	renderChangesListMarkdown,
	renderImagesListMarkdown,
	renderCodeSearchMarkdown,
	renderCommitSearchMarkdown,
	renderDirectoryMarkdown,
	renderFileMarkdown,
	renderGlobMarkdown,
	renderIssuesListMarkdown,
	renderParticipantsMarkdown,
	renderPrChecksMarkdown,
	renderPrCommitMarkdown,
	renderPrCommitsMarkdown,
	renderPrOverviewMarkdown,
	renderPrsListMarkdown,
	renderReviewCommentsMarkdown,
} from "./renderers/lists";
import { applyThreadFilters } from "./utils/filters";
import { globMatch } from "./utils/glob";
import { collectImages, imageExtFromUrl } from "./utils/images";
import { collectParticipants } from "./utils/participants";

export default function githubExtension(pi: ExtensionAPI) {
	const threadCache = new ThreadCache();
	const client = createGitHubClient(pi);

	async function fetchThreadCached(entity: Entity, owner: string, repo: string, number: number) {
		return threadCache.get(entity, owner, repo, number, () => fetchThread(client, entity, owner, repo, number));
	}

	async function downloadImage(entity: Entity, owner: string, repo: string, number: number, imageId: number, tmpDir = "/tmp"): Promise<string> {
		const items = await fetchThreadCached(entity, owner, repo, number);
		const images = collectImages(items);
		const image = images.find((candidate) => candidate.id === imageId);
		if (!image) throw new Error(`imageId ${imageId} not found`);

		await mkdir(tmpDir, { recursive: true });
		let token = "";
		try {
			token = (await client.ghText(["auth", "token"]))?.trim() ?? "";
		} catch {
			token = "";
		}

		const response = await fetch(image.url, {
			headers: token
				? {
					Authorization: `Bearer ${token}`,
					"User-Agent": "pi-github-tool",
				}
				: { "User-Agent": "pi-github-tool" },
		});
		if (!response.ok) {
			throw new Error(`failed to download image: HTTP ${response.status}`);
		}

		const bytes = new Uint8Array(await response.arrayBuffer());
		const ext = imageExtFromUrl(image.url);
		const file = join(tmpDir, `github-${owner}-${repo}-${entity}-${number}-image-${imageId}${ext}`);
		await writeFile(file, bytes);

		const lines = [
			"---",
			`entity: ${entity}`,
			`repo: ${owner}/${repo}`,
			`number: ${number}`,
			`image_id: ${imageId}`,
			`downloaded_to: ${file}`,
			`source_url: ${image.url}`,
			"---",
			"",
			`Downloaded image #${imageId} to: ${file}`,
			`File name: ${basename(file)}`,
		];
		return lines.join("\n");
	}

	pi.registerTool({
		name: "github",
		label: "GitHub Markdown",
		description:
			"Formats GitHub threads as chronological markdown. Supports list_issues/list_prs, issue/PR/discussion auto-detection, image IDs + download, and PR file-change IDs + per-file diff retrieval.",
		parameters: GithubParams,
		prepareArguments(args) {
			const next: Record<string, unknown> = { ...args };
			if (next.id === undefined && next.number !== undefined) next.id = next.number;
			if (next.changeId === undefined) {
				if (next.patchId !== undefined) next.changeId = next.patchId;
				else if (next.codeId !== undefined) next.changeId = next.codeId;
			}
			delete next.number;
			delete next.patchId;
			delete next.codeId;
			return next;
		},
		async execute(_toolCallId, rawParams, _signal, _onUpdate, _ctx) {
			const action: Action = (rawParams.action as Action | undefined) ?? "format";
			const page = Number(rawParams.page ?? 1);
			const perPage = Number(rawParams.perPage ?? 20);
			const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
			const normalizedPerPage = Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : 20;

			try {
				const { owner, repo } = await resolveRepo(pi, rawParams.owner, rawParams.repo);

				if (action === "read_file") {
					const path = typeof rawParams.path === "string" ? rawParams.path.trim().replace(/^\//, "") : "";
					if (!path) {
						return { content: [{ type: "text", text: "Error: path is required for action=read_file" }] };
					}
					const startLine = Number(rawParams.startLine ?? 1);
					const endLine = rawParams.endLine === undefined ? undefined : Number(rawParams.endLine);
					if (!Number.isInteger(startLine) || startLine < 1) {
						return { content: [{ type: "text", text: "Error: startLine must be an integer >= 1" }] };
					}
					if (endLine !== undefined && (!Number.isInteger(endLine) || endLine < startLine)) {
						return { content: [{ type: "text", text: "Error: endLine must be an integer >= startLine" }] };
					}
					const content = await fetchRepoFile(
						client,
						owner,
						repo,
						path,
						typeof rawParams.ref === "string" && rawParams.ref.trim() ? rawParams.ref.trim() : undefined,
					);
					const text = renderFileMarkdown(owner, repo, path, content, startLine, endLine);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_directory") {
					const path = typeof rawParams.path === "string" ? rawParams.path.trim().replace(/^\//, "") : "";
					const entries = await fetchRepoDirectory(
						client,
						owner,
						repo,
						path,
						typeof rawParams.ref === "string" && rawParams.ref.trim() ? rawParams.ref.trim() : undefined,
					);
					const text = renderDirectoryMarkdown(owner, repo, path || ".", entries);
					return { content: [{ type: "text", text }] };
				}

				if (action === "search_code") {
					const query = typeof rawParams.query === "string" ? rawParams.query.trim() : "";
					if (!query) {
						return { content: [{ type: "text", text: "Error: query is required for action=search_code" }] };
					}
					const path = typeof rawParams.path === "string" && rawParams.path.trim() ? rawParams.path.trim() : undefined;
					const results = await searchRepoCode(client, owner, repo, query, path, normalizedPage, normalizedPerPage);
					const text = renderCodeSearchMarkdown(owner, repo, query, results);
					return { content: [{ type: "text", text }] };
				}

				if (action === "glob_files") {
					const filePattern = typeof rawParams.filePattern === "string" ? rawParams.filePattern.trim() : "";
					if (!filePattern) {
						return { content: [{ type: "text", text: "Error: filePattern is required for action=glob_files" }] };
					}
					const files = await fetchRepoTreeFiles(
						client,
						owner,
						repo,
						typeof rawParams.ref === "string" && rawParams.ref.trim() ? rawParams.ref.trim() : undefined,
					);
					const matched = globMatch(files, filePattern);
					const offset = Math.max(0, Number(rawParams.offset ?? 0));
					const limit = rawParams.limit === undefined ? matched.length : Math.max(1, Number(rawParams.limit));
					const pageItems = matched.slice(offset, offset + limit);
					const text = renderGlobMarkdown(owner, repo, filePattern, pageItems, matched.length);
					return { content: [{ type: "text", text }] };
				}

				if (action === "search_commits") {
					const query = typeof rawParams.query === "string" ? rawParams.query.trim() : "";
					const author = typeof rawParams.author === "string" ? rawParams.author.trim() : "";
					const since = typeof rawParams.since === "string" ? rawParams.since.trim() : "";
					const until = typeof rawParams.until === "string" ? rawParams.until.trim() : "";
					const results = await searchRepoCommits(client, owner, repo, {
						query: query || undefined,
						author: author || undefined,
						since: since || undefined,
						until: until || undefined,
						page: normalizedPage,
						perPage: normalizedPerPage,
					});
					const queryLabel = [query || "*", author ? `author:${author}` : "", since ? `since:${since}` : "", until ? `until:${until}` : ""]
						.filter(Boolean)
						.join(" ");
					const text = renderCommitSearchMarkdown(owner, repo, queryLabel, results);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_issues") {
					const rows = await client.fetchRestPage(
						`/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=desc`,
						normalizedPage,
						normalizedPerPage,
					);
					const issues = rows.filter((row) => !row?.pull_request);
					const text = renderIssuesListMarkdown(owner, repo, normalizedPage, normalizedPerPage, issues);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_prs") {
					const prs = await client.fetchRestPage(
						`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc`,
						normalizedPage,
						normalizedPerPage,
					);
					const text = renderPrsListMarkdown(owner, repo, normalizedPage, normalizedPerPage, prs);
					return { content: [{ type: "text", text }] };
				}

				const id = Number(rawParams.id);
				if (!Number.isInteger(id) || id < 1) {
					return { content: [{ type: "text", text: "GitHub tool error: id must be an integer >= 1" }] };
				}

				const entity = (rawParams.entity as Entity | undefined) ?? (await inferEntity(client, owner, repo, id));

				if (action === "list_participants") {
					const items = await fetchThreadCached(entity, owner, repo, id);
					const participants = collectParticipants(items);
					const text = renderParticipantsMarkdown(entity, owner, repo, id, participants);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_images") {
					const items = await fetchThreadCached(entity, owner, repo, id);
					const images = collectImages(items);
					const text = renderImagesListMarkdown(entity, owner, repo, id, images);
					return { content: [{ type: "text", text }] };
				}

				if (action === "download_image") {
					if (!rawParams.imageId) {
						return {
							content: [{ type: "text", text: "Error: imageId is required for action=download_image" }],
						};
					}

					const text = await downloadImage(
						entity,
						owner,
						repo,
						id,
						Number(rawParams.imageId),
						typeof rawParams.tmpDir === "string" && rawParams.tmpDir.trim() ? rawParams.tmpDir : "/tmp",
					);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_changes") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=list_changes only works for pull requests" }] };
					}
					const changes = await fetchPrChanges(client, owner, repo, id);
					const text = renderChangesListMarkdown(owner, repo, id, changes);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_pr_commits") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=list_pr_commits only works for pull requests" }] };
					}
					const commits = await fetchPrCommits(client, owner, repo, id);
					const start = (normalizedPage - 1) * normalizedPerPage;
					const text = renderPrCommitsMarkdown(owner, repo, id, commits.slice(start, start + normalizedPerPage));
					return { content: [{ type: "text", text }] };
				}

				if (action === "get_pr_commit") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=get_pr_commit only works for pull requests" }] };
					}
					const commitSha = typeof rawParams.commitSha === "string" ? rawParams.commitSha.trim() : "";
					if (!commitSha) {
						return { content: [{ type: "text", text: "Error: commitSha is required for action=get_pr_commit" }] };
					}
					const commit = await fetchPrCommitDetail(client, owner, repo, id, commitSha);
					const text = renderPrCommitMarkdown(owner, repo, id, commit);
					return { content: [{ type: "text", text }] };
				}

				if (action === "pr_overview") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=pr_overview only works for pull requests" }] };
					}
					const overview = await fetchPrOverview(client, owner, repo, id, {
						includeFiles: rawParams.includeFiles !== false,
						includeReviews: rawParams.includeReviews !== false,
						includeChecks: rawParams.includeChecks !== false,
					});
					const text = renderPrOverviewMarkdown(owner, repo, overview);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_pr_checks") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=list_pr_checks only works for pull requests" }] };
					}
					const pr = await client.ghJson(["api", `/repos/${owner}/${repo}/pulls/${id}`]);
					const headSha = String(pr?.head?.sha ?? "").trim();
					if (!headSha) {
						throw new Error(`Could not resolve PR head SHA for #${id}`);
					}
					const checks = await fetchPrChecks(client, owner, repo, headSha);
					const text = renderPrChecksMarkdown(owner, repo, id, checks);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_review_comments") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=list_review_comments only works for pull requests" }] };
					}
					const allComments = await fetchReviewComments(client, owner, repo, id);
					const authorFilter = typeof rawParams.author === "string" ? rawParams.author.trim().toLowerCase() : "";
					const pathFilter = typeof rawParams.path === "string" ? rawParams.path.trim() : "";
					const sinceMs = typeof rawParams.since === "string" ? Date.parse(rawParams.since) : NaN;
					const untilMs = typeof rawParams.until === "string" ? Date.parse(rawParams.until) : NaN;

					const filtered = allComments.filter((comment) => {
						if (authorFilter && comment.author.toLowerCase() !== authorFilter) return false;
						if (pathFilter && comment.path !== pathFilter) return false;
						if (Number.isFinite(sinceMs) || Number.isFinite(untilMs)) {
							const createdMs = Date.parse(comment.createdAt);
							if (!Number.isFinite(createdMs)) return false;
							if (Number.isFinite(sinceMs) && createdMs < sinceMs) return false;
							if (Number.isFinite(untilMs) && createdMs > untilMs) return false;
						}
						return true;
					});

					const start = (normalizedPage - 1) * normalizedPerPage;
					const pageComments = filtered.slice(start, start + normalizedPerPage);
					const text = renderReviewCommentsMarkdown(owner, repo, id, pageComments);
					return { content: [{ type: "text", text }] };
				}

				if (action === "get_change") {
					if (entity !== "pr") {
						return { content: [{ type: "text", text: "Error: action=get_change only works for pull requests" }] };
					}
					const requestedChangeId = Number(rawParams.changeId);
					if (!Number.isInteger(requestedChangeId) || requestedChangeId < 1) {
						return {
							content: [{ type: "text", text: "Error: changeId (or patchId/codeId) is required for action=get_change" }],
						};
					}
					const changes = await fetchPrChanges(client, owner, repo, id);
					const change = changes.find((candidate) => candidate.id === requestedChangeId);
					if (!change) {
						throw new Error(`changeId ${requestedChangeId} not found`);
					}

					const text = renderChangeMarkdown(owner, repo, id, change);
					return { content: [{ type: "text", text }] };
				}

				const items = await fetchThreadCached(entity, owner, repo, id);
				const filteredItems = applyThreadFilters(items, {
					author: typeof rawParams.author === "string" ? rawParams.author : undefined,
					kind: typeof rawParams.kind === "string" ? rawParams.kind : undefined,
					since: typeof rawParams.since === "string" ? rawParams.since : undefined,
					until: typeof rawParams.until === "string" ? rawParams.until : undefined,
					contains: typeof rawParams.contains === "string" ? rawParams.contains : undefined,
				});
				const images = collectImages(filteredItems);
				const changes = entity === "pr" ? await fetchPrChanges(client, owner, repo, id) : undefined;
				const text = renderThreadMarkdown({
					entity,
					owner,
					repo,
					number: id,
					page: normalizedPage,
					perPage: normalizedPerPage,
					items: filteredItems,
					images,
					changes,
					filteredFromTotal: items.length,
				});
				return { content: [{ type: "text", text }] };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text", text: `GitHub tool error: ${message}` }] };
			}
		},
	});
}
