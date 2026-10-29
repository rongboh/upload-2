import { API, RADAR_PLAYLISTS } from "./constants.js";
import { addBrowseSongToPlaylist, playBrowseSong } from "./app.js";

const nav = document.getElementById("solaraBrowseNav");
const panel = document.getElementById("solaraBrowsePanel");
const heading = document.getElementById("solaraBrowseHeading");
const message = document.getElementById("solaraBrowseMessage");
const categories = document.getElementById("solaraBrowseCategories");
const list = document.getElementById("solaraBrowseList");
const addSelectedButton = document.getElementById("solaraBrowseAddSelected");
const selectAllButton = document.getElementById("solaraBrowseSelectAll");
let currentSongs = [];
let requestToken = 0;

const playlists = Array.isArray(RADAR_PLAYLISTS) ? RADAR_PLAYLISTS : [];
const latest = playlists.find((p) => String(p.id) === "3779629") || { id: "3779629", name: "新歌榜" };
const hot = playlists.find((p) => String(p.id) === "3778678") || { id: "3778678", name: "热歌榜" };

function setActive(view) {
    nav.querySelectorAll("[data-browse-view]").forEach((button) => {
        const active = button.dataset.browseView === view;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
    });
}
function resetPanel(view, title) {
    panel.hidden = false;
    heading.textContent = title;
    message.textContent = "";
    categories.hidden = true;
    categories.replaceChildren();
    list.replaceChildren();
    currentSongs = [];
    updateBatchButtons();
    setActive(view);
}
function button(label, className, action) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", action);
    return el;
}
function updateBatchButtons() {
    const count = list.querySelectorAll(".solara-browse-select:checked").length;
    addSelectedButton.disabled = count === 0;
    addSelectedButton.textContent = count ? `添加已选 (${count})` : "添加已选";
}
function normalize(song) {
    return {
        id: song.id, name: song.name || "未知歌曲",
        artist: Array.isArray(song.artist) ? song.artist.join(" / ") : (song.artist || "未知艺术家"),
        album: song.album || "", source: song.source || "netease",
        lyric_id: song.lyric_id || song.id, pic: song.pic || "",
        pic_id: song.pic_id || "", url_id: song.url_id || song.id
    };
}
function renderSongs(songs) {
    list.replaceChildren();
    currentSongs = songs.map(normalize);
    if (!currentSongs.length) message.textContent = "该榜单暂时没有可显示的歌曲。";
    currentSongs.forEach((song) => {
        const row = document.createElement("article");
        row.className = "solara-browse-track";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "solara-browse-select";
        check.setAttribute("aria-label", `选择歌曲：${song.name}`);
        check.addEventListener("change", updateBatchButtons);
        const cover = document.createElement("div");
        cover.className = "solara-browse-cover";
        if (song.pic) {
            const img = document.createElement("img");
            img.loading = "lazy"; img.alt = ""; img.src = song.pic;
            img.onerror = () => { img.remove(); cover.textContent = "♪"; };
            cover.append(img);
        } else cover.textContent = "♪";
        const info = document.createElement("div");
        info.className = "solara-browse-track-info";
        const name = document.createElement("div");
        name.className = "solara-browse-track-name"; name.textContent = song.name;
        const meta = document.createElement("div");
        meta.className = "solara-browse-track-meta";
        meta.textContent = [song.artist, song.album].filter(Boolean).join(" · ");
        info.append(name, meta);
        const actions = document.createElement("div");
        actions.className = "solara-browse-track-actions";
        actions.append(
            button("播放", "solara-browse-play", () => playBrowseSong(song)),
            button("添加", "solara-browse-add", () => addBrowseSongToPlaylist(song)),
            button("存入歌单", "solara-browse-custom-add", () => window.dispatchEvent(new CustomEvent("solara:add-to-custom-playlist", { detail: { song } })))
        );
        row.append(check, cover, info, actions);
        list.append(row);
    });
    updateBatchButtons();
}
function renderCategories() {
    categories.replaceChildren();
    playlists.forEach((playlist) => {
        const el = button(playlist.name, "solara-browse-category", () => loadPlaylist(playlist, "category"));
        if (playlist.description) el.title = playlist.description;
        categories.append(el);
    });
    categories.hidden = false;
    if (!playlists.length) message.textContent = "没有找到可用的官方榜单配置。";
}
async function loadPlaylist(playlist, view) {
    const token = ++requestToken;
    resetPanel(view, playlist.name || "音乐榜单");
    message.textContent = "正在获取网易云音乐榜单…";
    try {
        const result = await API.getRadarPlaylist(playlist.id, { limit: 30, offset: 0 });
        if (token !== requestToken) return;
        if (!Array.isArray(result)) throw new Error("返回数据格式不正确");
        message.textContent = `数据来源：网易云音乐官方歌单 · 共 ${result.length} 首`;
        renderSongs(result);
    } catch (error) {
        if (token !== requestToken) return;
        console.error("[浏览导航] 榜单获取失败：", error);
        message.textContent = "获取榜单失败。请检查网络连接及现有 API 代理配置。";
        list.replaceChildren(); currentSongs = []; updateBatchButtons();
    }
}
nav.addEventListener("click", (event) => {
    const target = event.target.closest("[data-browse-view]");
    if (!target) return;
    const view = target.dataset.browseView;
    if (view === "home") {
        requestToken++; panel.hidden = true; categories.hidden = true;
        list.replaceChildren(); message.textContent = ""; setActive("home");
    } else if (view === "category") {
        requestToken++; resetPanel("category", "分类浏览");
        message.textContent = "选择一个网易云官方榜单开始浏览。";
        renderCategories();
    } else if (view === "latest") loadPlaylist(latest, "latest");
    else if (view === "hot") loadPlaylist(hot, "hot");
});
selectAllButton.addEventListener("click", () => {
    const boxes = [...list.querySelectorAll(".solara-browse-select")];
    if (!boxes.length) return;
    const select = boxes.some((box) => !box.checked);
    boxes.forEach((box) => { box.checked = select; });
    selectAllButton.textContent = select ? "取消全选" : "全选";
    updateBatchButtons();
});
addSelectedButton.addEventListener("click", () => {
    const selected = [...list.querySelectorAll(".solara-browse-select:checked")];
    if (!selected.length) return;
    let added = 0;
    selected.forEach((checkbox) => {
        const rowIndex = [...list.children].indexOf(checkbox.closest(".solara-browse-track"));
        const song = currentSongs[rowIndex];
        if (!song) return;
        const before = window.__solaraBrowseAddedCount || 0;
        const index = addBrowseSongToPlaylist(song, { notify: false });
        if (index >= 0) {
            // 由接口返回列表索引；统计提示不影响添加/去重结果。
            window.__solaraBrowseAddedCount = before + 1;
            added++;
        }
    });
    message.textContent = `已处理 ${selected.length} 首所选歌曲。重复歌曲会沿用现有播放列表条目。`;
    selected.forEach((box) => { box.checked = false; });
    updateBatchButtons();
});
setActive("home");
panel.hidden = true;
