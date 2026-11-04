// Where the reserved area reads and saves files.
// GitHub: every save is one commit on the site's repository, so nothing is ever lost
// (any earlier version can be restored from the repository history).
// Local: during development (tools/admin-dev.mjs) files are written straight to disk.
import { REPO } from '../render.js';

// files: { path: string (text) | { base64 } (photo) | null (delete) }
export class GitHubStore {
  constructor(token) { this.token = token; }

  api(path, init = {}) {
    return fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
    });
  }

  async json(path, init) {
    const r = await this.api(path, init);
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  // Checks the key can write to the repository.
  async check() {
    const repo = await this.json('');
    if (!repo.permissions?.push) throw new Error('La chiave non può modificare il sito');
  }

  async read(path) {
    const r = await this.api(`/contents/${path}?ref=${REPO.branch}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} reading ${path}`);
    return r.text();
  }

  // The last published versions of the content, newest first.
  async history() {
    const list = await this.json(`/commits?path=content/live.json&sha=${REPO.branch}&per_page=20`);
    return list.map((c) => ({ sha: c.sha, date: c.commit.committer.date, message: c.commit.message.split('\n')[0] }));
  }

  async readAt(path, sha) {
    const r = await this.api(`/contents/${path}?ref=${sha}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!r.ok) throw new Error(`GitHub ${r.status} reading ${path}`);
    return r.text();
  }

  async commit(files, message) {
    const ref = await this.json(`/git/ref/heads/${REPO.branch}`);
    const head = await this.json(`/git/commits/${ref.object.sha}`);
    const tree = [];
    for (const [path, f] of Object.entries(files)) {
      if (f === null) tree.push({ path, mode: '100644', type: 'blob', sha: null });
      else if (typeof f === 'string') tree.push({ path, mode: '100644', type: 'blob', content: f });
      else {
        const blob = await this.json('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.base64, encoding: 'base64' }) });
        tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }
    const newTree = await this.json('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
    const commit = await this.json('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
    await this.json(`/git/refs/heads/${REPO.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  }
}

export class LocalStore {
  static async available() {
    if (!/^(localhost|127\.)/.test(location.hostname)) return false;
    try { return (await fetch('/__dev/ping')).ok; } catch (e) { return false; }
  }

  async read(path) {
    const r = await fetch(`/__dev/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    return r.text();
  }

  async commit(files, message) {
    const r = await fetch('/__dev/commit', { method: 'POST', body: JSON.stringify({ files, message }) });
    if (!r.ok) throw new Error(await r.text());
  }
}
