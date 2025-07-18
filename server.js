// server.js – all-in-one, ESM, 2024-06 verified
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import YTDlpWrap from "yt-dlp-wrap";
import { pipeline } from "stream";
import { promisify } from "util";
const pipe = promisify(pipeline);

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- front-end ---------- */
const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Universal Downloader</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#fafafa;color:#111}
    header{background:#111;color:#fff;padding:1rem 2rem}
    nav button{margin-right:.5rem;padding:.4rem .8rem;border:none;background:#444;color:#fff;cursor:pointer}
    nav button:hover{background:#666}
    .tab{padding:2rem;max-width:600px;margin:auto}
    .hidden{display:none}
    input{width:100%;max-width:400px;padding:.5rem;margin-right:.5rem}
    .dl-btn{display:inline-block;margin:.3rem;padding:.4rem .8rem;background:#0077ff;color:#fff;text-decoration:none;border-radius:3px}
    .dl-btn:hover{background:#005ed1}
    ul{list-style:none;padding:0}
  </style>
</head>
<body>
  <header><h1>Universal Video Downloader</h1>
    <nav>
      <button data-tab="ig">Instagram</button>
      <button data-tab="tw">Twitter / X</button>
      <button data-tab="any">Any Link</button>
    </nav>
  </header>
  <main>
    <section id="ig" class="tab">
      <h2>Instagram Video / Reel / IGTV</h2>
      <input type="url" placeholder="Paste Instagram link…" />
      <button class="fetch">Grab Links</button>
      <ul class="links"></ul>
    </section>
    <section id="tw" class="tab hidden">
      <h2>Twitter / X Video</h2>
      <input type="url" placeholder="Paste Tweet link…" />
      <button class="fetch">Grab Links</button>
      <ul class="links"></ul>
    </section>
    <section id="any" class="tab hidden">
      <h2>Any Public Video</h2>
      <input type="url" placeholder="Paste any public video URL…" />
      <button class="fetch">Grab Links</button>
      <ul class="links"></ul>
    </section>
  </main>
  <script>
    const API = "";
    const tabs = document.querySelectorAll("nav button");
    const sections = document.querySelectorAll(".tab");
    tabs.forEach(b => b.addEventListener("click", () => {
      sections.forEach(s => s.classList.add("hidden"));
      document.getElementById(b.dataset.tab).classList.remove("hidden");
    }));
    document.querySelectorAll(".tab").forEach(tab => {
      tab.querySelector(".fetch").addEventListener("click", async () => {
        const url = tab.querySelector("input").value.trim();
        const list = tab.querySelector(".links");
        list.innerHTML = "<li>Loading…</li>";
        const ep = tab.id === "ig" ? "instagram" : tab.id === "tw" ? "twitter" : "generic";
        try {
          const res = await fetch(\`\${API}/api/\${ep}\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });
          const json = await res.json();
          list.innerHTML = "";
          const videos = json.url_list || json.videos || (json.url ? [{url: json.url}] : []);
          videos.forEach(v => list.appendChild(Object.assign(document.createElement("li"), {
            appendChild: (() => {
              const a = document.createElement("a");
              a.href = \`/dl?url=\${encodeURIComponent(v.url)}&filename=video.mp4\`;
              a.textContent = v.quality ? \`\${v.quality} – Download\` : "Download";
              a.className = "dl-btn";
              return a;
            })()
          })));
          if (!videos.length) list.innerHTML = "<li>No video found</li>";
        } catch {
          list.innerHTML = "<li>Error – try again</li>";
        }
      });
    });
  </script>
</body>
</html>
`;
app.get("/", (_req, res) => res.send(html));

/* ---------- Instagram ---------- */
app.post("/api/instagram", async (req, res) => {
  try {
    const { url } = req.body;
    const ytDlp = new YTDlpWrap();
    const info = await ytDlp.getVideoInfo([url, "--no-playlist"]);
    const videos = info.formats
      .filter(f => f.ext === "mp4" && f.url)
      .map(f => ({
        quality: f.height ? `${f.height}p` : "unknown",
        url: f.url
      }));
    res.json({ url_list: videos });
  } catch {
    res.status(400).json({ error: "Instagram video unavailable or private" });
  }
});

/* ---------- Twitter ---------- */
app.post("/api/twitter", async (req, res) => {
  try {
    const { url } = req.body;
    const ytDlp = new YTDlpWrap();
    const info = await ytDlp.getVideoInfo([url, "--no-playlist"]);
    const videos = info.formats
      .filter(f => f.ext === "mp4" && f.url)
      .map(f => ({
        quality: f.height ? `${f.height}p` : "unknown",
        url: f.url
      }));
    res.json({ videos });
  } catch {
    res.status(400).json({ error: "Twitter video unavailable or private" });
  }
});

/* ---------- Generic fallback ---------- */
app.post("/api/generic", async (req, res) => {
  try {
    const { url } = req.body;
    const ytDlp = new YTDlpWrap();
    const info = await ytDlp.getVideoInfo([url, "--no-playlist"]);
    const videos = info.formats
      .filter(f => f.ext === "mp4" && f.url)
      .map(f => ({
        quality: f.height ? `${f.height}p` : "unknown",
        url: f.url
      }));
    res.json({ url_list: videos });
  } catch {
    res.status(400).json({ error: "Unsupported or private URL" });
  }
});

/* ---------- Download proxy ---------- */
app.get("/dl", async (req, res) => {
  const { url, filename = "video.mp4" } = req.query;
  try {
    const response = await fetch(url);
    res.set({
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    await promisify(pipeline)(response.body, res);
  } catch {
    res.status(500).send("Download failed");
  }
});

/* ---------- Bind to Render port ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
