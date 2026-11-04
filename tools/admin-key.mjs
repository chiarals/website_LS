// Creates admin/key.json: the GitHub key of the reserved area, locked with a password.
// Run it once, and again to change the password or when the GitHub key expires:
//   node tools/admin-key.mjs
//   node tools/admin-key.mjs --temporanea   generates a temporary password and prints it:
//                                           at the first entry Chiara must choose her own.
// The GitHub key: github.com/settings/personal-access-tokens/new, "Only select repositories"
// -> website_LS, Repository permissions -> Contents: Read and write. Nothing else.
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { lock, unlock } from '../admin/crypto.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Reads a line without showing what is typed.
function ask(question) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); ok(a.trim()); });
  });
}

const token = await ask('Chiave GitHub (github_pat_...): ');
if (!/^(github_pat_|ghp_)/.test(token)) { console.error('Serve una chiave GitHub che inizia con github_pat_ (o ghp_)'); process.exit(1); }
const r = await fetch('https://api.github.com/repos/chiarals/website_LS', { headers: { Authorization: `Bearer ${token}` } });
const repo = await r.json();
if (!r.ok || !repo.permissions?.push) { console.error('La chiave non può modificare chiarals/website_LS:', r.status, repo.message || 'manca Contents: Read and write'); process.exit(1); }

const temporary = process.argv.includes('--temporanea');
const WORDS = ['calice', 'tappo', 'botte', 'grappolo', 'cantina', 'vendemmia', 'bollicina', 'sughero', 'decanter', 'terrazza', 'brindisi', 'vigna', 'annata', 'barrique', 'mosto', 'perlage'];
const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
let password;
if (temporary) {
  password = `${pick()}-${pick()}-${pick()}-${String(crypto.getRandomValues(new Uint32Array(1))[0] % 90 + 10)}`;
} else {
  password = await ask('Password dell’area riservata: ');
  if (password.length < 12) { console.error('Usa almeno 12 caratteri: per esempio una frase breve.'); process.exit(1); }
  if (await ask('Ripeti la password: ') !== password) { console.error('Le due password non coincidono.'); process.exit(1); }
}

const box = { ...(await lock(token, password)), ...(temporary ? { temporary: true } : {}) };
if (await unlock(box, password) !== token) throw new Error('check failed');
fs.writeFileSync(path.join(root, 'admin/key.json'), JSON.stringify(box, null, 2) + '\n');
if (temporary) console.log(`Password temporanea: ${password}\nAl primo accesso Chiara deve sceglierne una sua.`);
console.log('Fatto: admin/key.json. Fai commit e push per attivare la password sul sito.');
