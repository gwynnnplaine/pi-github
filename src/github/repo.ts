import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Entity, RepoCoordinates } from "../types";
import type { GitHubClient } from "./client";

export function parseGitHubRemote(remoteUrl: string): RepoCoordinates | null {
	const url = remoteUrl.trim();
	const patterns = [
		/^git@github\.com:([^/]+)\/([^\s]+?)(?:\.git)?$/i,
		/^https?:\/\/github\.com\/([^/]+)\/([^\s/]+?)(?:\.git)?\/?$/i,
		/^ssh:\/\/git@github\.com\/([^/]+)\/([^\s/]+?)(?:\.git)?\/?$/i,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (!match) continue;
		return { owner: match[1], repo: match[2] };
	}

	return null;
}

export async function resolveRepo(pi: ExtensionAPI, rawOwner?: unknown, rawRepo?: unknown): Promise<RepoCoordinates> {
	const owner = typeof rawOwner === "string" ? rawOwner.trim() : "";
	const repo = typeof rawRepo === "string" ? rawRepo.trim() : "";
	if (owner && repo) return { owner, repo };

	let remoteUrl = "";
	try {
		remoteUrl = (await pi.exec("git", ["remote", "get-url", "origin"]))?.stdout?.trim() ?? "";
	} catch {
		throw new Error("Could not detect GitHub repo from git origin. Set git remote 'origin' or pass owner/repo explicitly.");
	}

	const parsed = parseGitHubRemote(remoteUrl);
	if (!parsed) {
		throw new Error(`Could not parse GitHub origin URL: ${remoteUrl}`);
	}
	return parsed;
}

export async function inferEntity(client: GitHubClient, owner: string, repo: string, id: number): Promise<Entity> {
	try {
		const issueLike = await client.ghJson(["api", `/repos/${owner}/${repo}/issues/${id}`]);
		return issueLike?.pull_request ? "pr" : "issue";
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const notFound = message.includes("Not Found") || message.includes("HTTP 404") || message.includes(": 404");
		if (!notFound) throw error;
	}

	const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id
    }
  }
}
`;

	const payload = await client.ghJson([
		"api",
		"graphql",
		"-f",
		`query=${query}`,
		"-F",
		`owner=${owner}`,
		"-F",
		`repo=${repo}`,
		"-F",
		`number=${id}`,
	]);

	if (payload?.data?.repository?.discussion?.id) return "discussion";
	throw new Error(`No issue, PR, or discussion found for id ${id} in ${owner}/${repo}`);
}
