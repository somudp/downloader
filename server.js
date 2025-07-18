// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

// ESM helper for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- Serve static front-end ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Health-check root route ---------- */
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ---------- Instagram ---------- */
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

/* ---------- Twitter / X ---------- */
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

/* ---------- Generic fallback ---------- */
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

/* ---------- Force-download proxy ---------- */
import { pipeline } from "stream";
import { promisify } from "util";
const pipe = promisify(pipeline);

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

/* ---------- Bind to 0.0.0.0 on Render-supplied port ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
