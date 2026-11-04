# website_LS

Sito di La Sputacchiera: https://lasputacchiera.com (GitHub Pages, dal branch `main`).

## Area riservata: https://lasputacchiera.com/admin/

Chiara modifica testi (IT/EN), foto, corsi e domande frequenti senza toccare il codice:
modifica con l'anteprima a fianco → **Salva bozza** → **Guarda l'anteprima del sito**
(il sito vero con la barra "Anteprima"; da lì **Vedi come su telefono** lo mostra in una
cornice da telefono, `admin/telefono.html`) → **Pubblica** oppure **Scarta la bozza**.
In "Altro" → **Versioni pubblicate** si ricarica una versione precedente.

- I contenuti stanno in `content/live.json` (pubblicato) e `content/draft.json` (bozza, se c'è).
  Ogni salvataggio è un commit: la cronologia del repo è anche il backup.
- La password sblocca una chiave GitHub cifrata in `admin/key.json` (fine-grained, solo
  questo repo, *Contents: Read and write*). La prima configurazione, una nuova chiave quando
  scade e il cambio password si fanno dall'area stessa; in alternativa `node tools/admin-key.mjs`
  (`--temporanea` genera una password temporanea: al primo accesso Chiara ne sceglie una sua).
- Le foto caricate finiscono in `assets/foto/uploads/` (JPEG, max 2000px).

## Sviluppo

- `./dev.sh` → http://localhost:5500 (live reload).
- `node tools/admin-dev.mjs` → http://localhost:5501/admin/: l'area riservata senza password,
  che salva e pubblica nei file di questa cartella invece che su GitHub.
- Le pagine segnano con `<!--render:nome-->…<!--/render:nome-->` le parti costruite dai
  contenuti; `render.js` le genera sia nel browser sia alla pubblicazione.
- Se modifichi `content/live.json` a mano: `node tools/bake.mjs` (scrive i testi italiani
  nell'HTML per i motori di ricerca e rigenera `llms.txt` / `llms-full.txt`).
- Un testo nuovo nelle pagine: `data-i18n="chiave"` nell'HTML, la chiave in `content/live.json`
  (`texts.it` e `texts.en`) e, se Chiara deve poterlo cambiare, una riga in `admin/schema.js`.
- Prima di modificare il codice fai `git pull`: Chiara pubblica direttamente su `main`.
