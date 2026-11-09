# Putting the memorial site online

The site is the `site/` folder. It is served by one Cloudflare Worker named **`memorial-app`** (`wrangler.jsonc`),
deployed from this GitHub repo: **every push to `main` goes live** within about a minute.
There is no Worker code and no secret: the pages talk to Supabase directly with the public key in `site/config.js`,
and Supabase's row rules (RLS) decide who may read or change what. Only signed-in admins can change anything.

```
site/          the website: index.html (Watch), document.html, admin.html, their .js/.css, vendor/
data-model/    the database: schema.sql, supabase-setup.sql, updates/ (run by hand in Supabase)
tagging/       the original tag CSVs
subtitles/     the .sbv subtitle files
wrangler.jsonc tells Cloudflare what to serve
```

Not in GitHub: `Historic documents/` and `upload/` (scans and videos). Scans live in Supabase Storage, videos on YouTube.

## One-time setup (about 10 minutes)

1. **Cloudflare dashboard → Workers & Pages → Create → Import a repository.**
   Allow the Cloudflare GitHub app access to `mutchist/memorial-app`, then choose it.
2. Name: **`memorial-app`** (must match `name` in `wrangler.jsonc`). Production branch: **`main`**.
   Build command: leave empty. Deploy command: `npx wrangler deploy` (the default). Save and deploy.
3. Open the address it shows, `https://memorial-app.<your-subdomain>.workers.dev`:
   - `/` or `/index.html`: the Watch page
   - `/admin.html`: the admin (same email and password as before)
4. **Videos:** YouTube plays here without error 153, because the page has a real web address.
5. **Own domain (optional, later):** Worker → Settings → Domains & Routes → Add → Custom domain.

## Every change after that

Push to `main` = live. A normal reload shows it (the site tells browsers to always check for a newer version, `site/_headers`).

## Running it on the PC

`start-site.bat` still serves `site/` on http://localhost:8080 for trying things out. Both use the same Supabase database.
