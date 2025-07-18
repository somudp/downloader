// server.js  –  no public folder required
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { pipeline } from "stream";
import { promisify } from "util";
const pipe = promisify(pipeline);

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- Front-end (index.html) ---------- */
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
  <header>
    <h1>Universal Video Downloader</h1>
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

/* ---------- Serve root ---------- */
app.get("/", (_req, res) => res.send(html));

/* ---------- APIs ---------- */
app.post("/api/instagram", async (req, res) => {
  try {
    const { url } = req.body;
    const shortcode =
      url.split("/p/")[1]?.split("/")[0] ||
      url.split("/reel/")[1]?.split("/")[0];
    if (!shortcode) return res.status(400).json({ error: "Bad IG URL" });

    const api = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const html = await fetch(api, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const json = JSON.parse(html);
    const media = json.items?.[0];
    if (!media) return res.status(400).json({ error: "Private / removed" });

    const videos = [];
    if (media.video_versions) {
      media.video_versions.forEach((v) =>
        videos.push({ quality: `${v.height}p`, url: v.url })
      );
    }
    return res.json({ url_list: videos });
  } catch {
    return res.status(400).json({ error: "Instagram fetch failed" });
  }
});

app.post("/api/twitter", async (req, res) => {
  try {
    const { url } = req.body;
    const id = url.match(/status\/(\d+)/)?.[1];
    if (!id) return res.status(400).json({ error: "Bad Tweet URL" });

    const api = `https://api.vxtwitter.com/Twitter/status/${id}`;
    const json = await fetch(api).then((r) => r.json());
    if (!json.media_extended?.length)
      return res.status(400).json({ error: "No video in tweet" });

    const videos = json.media_extended
      .filter((m) => m.type === "video")
      .map((v) => ({ quality: `${v.width}x${v.height}`, url: v.url }));
    return res.json({ videos });
  } catch {
    return res.status(400).json({ error: "Twitter fetch failed" });
  }
});

app.post("/api/generic", async (req, res) => {
  try {
    const { url } = req.body;
    const html = await fetch(url).then((r) => r.text());
    const $ = cheerio.load(html);
    const vid =
      $("video source").attr("src") ||
      $('meta[property="og:video"]').attr("content");
    return res.json({ url: vid });
  } catch {
    return res.status(400).json({ error: "Unsupported URL" });
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
    await pipe(response.body, res);
  } catch {
    res.status(500).send("Download failed");
  }
});

/* ---------- Bind to Render port & host ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
