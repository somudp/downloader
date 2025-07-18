const API = "";
const tabs = document.querySelectorAll("nav button");
const sections = document.querySelectorAll(".tab");

/* tab switch */
tabs.forEach(b => b.addEventListener("click", () => {
  sections.forEach(s => s.classList.add("hidden"));
  document.getElementById(b.dataset.tab).classList.remove("hidden");
}));

/* helpers */
const $ = s => document.querySelector(s);
const makeBtn = (url, label) => {
  const a = document.createElement("a");
  a.href = `/dl?url=${encodeURIComponent(url)}&filename=video.mp4`;
  a.textContent = label;
  a.className = "dl-btn";
  return a;
};

/* fetch */
document.querySelectorAll(".tab").forEach(tab => {
  tab.querySelector(".fetch").addEventListener("click", async () => {
    const url = tab.querySelector("input").value.trim();
    const list = tab.querySelector(".links");
    list.innerHTML = "<li>Loading…</li>";

    const ep = tab.id === "ig" ? "instagram" : tab.id === "tw" ? "twitter" : "generic";
    try {
      const res = await fetch(`${API}/api/${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const json = await res.json();
      list.innerHTML = "";
      const videos = json.url_list || json.videos || (json.url ? [{ url: json.url }] : []);
      if (!videos.length) list.innerHTML = "<li>No video found</li>";
      videos.forEach(v => list.appendChild(Object.assign(document.createElement("li"), {
        appendChild: makeBtn(v.url, v.quality ? `${v.quality} - Download` : "Download")
      })));
    } catch {
      list.innerHTML = "<li>Error – try again</li>";
    }
  });
});