// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cheerio from "cheerio";
import { getTwitterVideo } from "twitter-url-direct";

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- Instagram ---------- */
app.post("/api/instagram", async (req, res) => {
  try {
    const { url } = req.body;
    const shortcode = url.split("/p/")[1]?.split("/")[0] || url.split("/reel/")[1]?.split("/")[0];
    if (!shortcode) return res.status(400).json({ error: "Bad IG URL" });

    const api = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const html = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.text());
    const json = JSON.parse(html);
    const media = json.items?.[0];
    if (!media) return res.status(400).json({ error: "Private or removed" });

    const videos = [];
    if (media.video_versions) {
      media.video_versions.forEach(v => videos.push({ quality: `${v.height}p`, url: v.url }));
    }
    res.json({ url_list: videos });
  } catch (e) {
    res.status(400).json({ error: "Failed to fetch Instagram video" });
  }
});

/* ---------- Twitter ---------- */
app.post("/api/twitter", async (req, res) => {
  try {
    const { url } = req.body;
    const data = await getTwitterVideo(url);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: "Twitter fetch failed" });
  }
});

/* ---------- Generic ---------- */
app.post("/api/generic", async (req, res) => {
  try {
    const { url } = req.body;
    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);
    const vid = $("video source").attr("src") || $("meta[property='og:video']").attr("content");
    res.json({ url: vid });
  } catch {
    res.status(400).json({ error: "Unsupported URL" });
  }
});

/* ---------- Force-download proxy ---------- */
import { pipeline } from "stream";
import { promisify } from "util";
const pipe = promisify(pipeline);
import { createWriteStream } from "fs";

app.get("/dl", async (req, res) => {
  const { url, filename = "video.mp4" } = req.query;
  try {
    const response = await fetch(url);
    res.set({
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`
    });
    await pipe(response.body, res);
  } catch {
    res.status(500).send("Download failed");
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`> http://localhost:${PORT}`));