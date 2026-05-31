import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type GitHubClient = {
	ghJson: (args: string[]) => Promise<any>;
	ghText: (args: string[]) => Promise<string>;
	fetchAllRestPages: (path: string) => Promise<any[]>;
	fetchRestPage: (path: string, page: number, perPage: number) => Promise<any[]>;
};

export function createGitHubClient(pi: ExtensionAPI): GitHubClient {
	async function ghJson(args: string[]) {
		const result = await pi.exec("gh", args);
		return JSON.parse(result.stdout);
	}

	async function ghText(args: string[]) {
		const result = await pi.exec("gh", args);
		return result.stdout;
	}

	async function fetchAllRestPages(path: string): Promise<any[]> {
		const out: any[] = [];
		let page = 1;

		while (true) {
			const separator = path.includes("?") ? "&" : "?";
			const url = `${path}${separator}per_page=100&page=${page}`;
			const data = await ghJson(["api", url]);
			if (!Array.isArray(data)) {
				const message = typeof data?.message === "string" ? data.message : "non-array response";
				throw new Error(`GitHub API error for ${url}: ${message}`);
			}
			if (data.length === 0) break;
			out.push(...data);
			if (data.length < 100) break;
			page += 1;
		}

		return out;
	}

	async function fetchRestPage(path: string, page: number, perPage: number): Promise<any[]> {
		const separator = path.includes("?") ? "&" : "?";
		const url = `${path}${separator}per_page=${perPage}&page=${page}`;
		const data = await ghJson(["api", url]);
		if (!Array.isArray(data)) {
			const message = typeof data?.message === "string" ? data.message : "non-array response";
			throw new Error(`GitHub API error for ${url}: ${message}`);
		}
		return data;
	}

	return {
		ghJson,
		ghText,
		fetchAllRestPages,
		fetchRestPage,
	};
}
