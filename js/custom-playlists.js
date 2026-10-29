(() => {
    "use strict";

    const KEY = "customPlaylists";
    const nav = document.getElementById("solaraBrowseNav");
    const browsePanel = document.getElementById("solaraBrowsePanel");
    if (!nav || !browsePanel) {
        console.error("[自定义歌单] 页面元素缺失，模块未启动。");
        return;
    }

    const panel = document.createElement("section");
    panel.id = "solaraCustomPlaylistsPanel";
    panel.className = "solara-custom-panel";
    panel.hidden = true;
    panel.innerHTML = `
        <div class="solara-custom-header">
            <h3>歌单</h3>
            <button type="button" data-action="create">＋ 新建歌单</button>
        </div>
        <p class="solara-custom-message" aria-live="polite"></p>
        <div class="solara-custom-layout">
            <div class="solara-custom-list" aria-label="自定义歌单列表"></div>
            <div class="solara-custom-detail">
                <div class="solara-custom-detail-header">
                    <h4>请选择一个歌单</h4>
                    <div class="solara-custom-actions"></div>
                </div>
                <div class="solara-custom-songs"></div>
            </div>
        </div>`;
    browsePanel.insertAdjacentElement("afterend", panel);

    const createNavButton = nav.querySelector('[data-browse-view="custom"]');
    if (!createNavButton) {
        console.error("[自定义歌单] 导航按钮缺失，模块未启动。");
        return;
    }

    const message = panel.querySelector(".solara-custom-message");
    const listEl = panel.querySelector(".solara-custom-list");
    const detailTitle = panel.querySelector(".solara-custom-detail-header h4");
    const actionsEl = panel.querySelector(".solara-custom-actions");
    const songsEl = panel.querySelector(".solara-custom-songs");

    let playlists = readPlaylists();
    let selectedId = playlists[0]?.id || null;

    function readPlaylists() {
        try {
            const raw = localStorage.getItem(KEY);
            const value = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(value)) return [];
            return value
                .filter(p =>
                    p && typeof p.id === "string" &&
                    typeof p.name === "string" && Array.isArray(p.songs)
                )
                .map(p => ({ ...p, loopEnabled: Boolean(p.loopEnabled) }));
        } catch (error) {
            console.error("[自定义歌单] 读取失败：", error);
            return [];
        }
    }

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(playlists));
            return true;
        } catch (error) {
            console.error("[自定义歌单] 保存失败：", error);
            message.textContent = "保存失败，可能是浏览器存储空间不足或存储被禁用。";
            return false;
        }
    }

    function makeId() {
        return globalThis.crypto?.randomUUID?.() ||
            `pl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function selectedPlaylist() {
        return playlists.find(p => p.id === selectedId) || null;
    }

    function songKey(song) {
        const source = String(song.source || "netease").toLowerCase();
        const id = song.id == null ? "" : String(song.id);
        return id ? `${source}:${id}` :
            `${source}:${String(song.name || "").trim()}:${String(song.artist || "").trim()}`;
    }

    function makeButton(label, action, className = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = className;
        button.addEventListener("click", action);
        return button;
    }

    function render() {
        listEl.replaceChildren();
        songsEl.replaceChildren();
        actionsEl.replaceChildren();

        if (!playlists.some(p => p.id === selectedId)) {
            selectedId = playlists[0]?.id || null;
        }

        playlists.forEach(playlist => {
            const item = makeButton(
                `${playlist.name}（${playlist.songs.length}）`,
                () => { selectedId = playlist.id; render(); },
                "solara-custom-playlist-item"
            );
            item.classList.toggle("is-selected", playlist.id === selectedId);
            item.setAttribute("aria-pressed", String(playlist.id === selectedId));
            listEl.append(item);
        });

        const playlist = selectedPlaylist();
        if (!playlist) {
            detailTitle.textContent = "请选择一个歌单";
            const empty = document.createElement("p");
            empty.textContent = playlists.length
                ? "请选择左侧歌单查看歌曲。"
                : "还没有歌单，请点击“新建歌单”。";
            songsEl.append(empty);
            return;
        }

        detailTitle.textContent = playlist.name;

        const loopButton = makeButton(
            "",
            () => {
                const previous = Boolean(playlist.loopEnabled);
                playlist.loopEnabled = !previous;
                if (!save()) {
                    playlist.loopEnabled = previous;
                    render();
                    return;
                }
                message.textContent = playlist.loopEnabled
                    ? "已开启本歌单循环。"
                    : "已关闭本歌单循环，将遵守全局播放模式。";
                render();
            },
            "transport-button transport-button--mode solara-custom-loop-toggle"
        );
        loopButton.innerHTML = '<svg class="apple-svg-icon icon-repeat-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
        loopButton.setAttribute("aria-pressed", String(Boolean(playlist.loopEnabled)));
        loopButton.setAttribute(
            "aria-label",
            playlist.loopEnabled ? "关闭本歌单循环" : "开启本歌单循环"
        );
        loopButton.title = playlist.loopEnabled
            ? "本歌单循环已开启，点击关闭"
            : "本歌单循环已关闭，点击开启";
        loopButton.classList.toggle("active", Boolean(playlist.loopEnabled));

        actionsEl.append(
            loopButton,
            makeButton("重命名", () => renamePlaylist(playlist)),
            makeButton("删除歌单", () => deletePlaylist(playlist), "is-danger")
        );

        if (!playlist.songs.length) {
            const empty = document.createElement("p");
            empty.textContent = "这个歌单还没有歌曲。浏览榜单时可点击“存入歌单”添加。";
            songsEl.append(empty);
            return;
        }

        playlist.songs.forEach((song, index) => {
            const row = document.createElement("div");
            row.className = "solara-custom-song";

            const info = document.createElement("div");
            info.className = "solara-custom-song-info";
            const title = document.createElement("strong");
            title.textContent = song.name || "未知歌曲";
            const artist = document.createElement("span");
            artist.textContent = song.artist || "未知艺术家";
            info.append(title, artist);

            const controls = document.createElement("div");
            controls.className = "solara-custom-song-actions";
            controls.append(
                makeButton("播放", () => {
                    if (typeof window.playCustomPlaylistSong === "function") {
                        window.playCustomPlaylistSong(playlist.id, index);
                    } else {
                        message.textContent = "播放器接口尚未加载，请刷新页面后重试。";
                    }
                }),
                makeButton("复制到", () => copySongWithDestination(playlist, index)),
                makeButton("移动到", () => transferSong(playlist, index, "move")),
                makeButton("移除", () => {
                    const oldSongs = [...playlist.songs];
                    playlist.songs.splice(index, 1);
                    if (save()) {
                        message.textContent = "已从歌单移除歌曲。";
                        render();
                    } else {
                        playlist.songs = oldSongs;
                        render();
                    }
                })
            );
            row.append(info, controls);
            songsEl.append(row);
        });
    }

    function normalizeSong(song) {
        return {
            id: song.id == null ? "" : String(song.id),
            name: String(song.name || "未知歌曲"),
            artist: Array.isArray(song.artist)
                ? song.artist.join(" / ")
                : String(song.artist || "未知艺术家"),
            album: String(song.album || ""),
            source: String(song.source || "netease"),
            lyric_id: song.lyric_id || song.id || "",
            pic: String(song.pic || ""),
            pic_id: song.pic_id || "",
            url_id: song.url_id || song.id || ""
        };
    }

    function chooseTransferTarget(source, operation) {
        const available = playlists.filter(p => p.id !== source.id);
        const choices = available.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
        const promptText =
            `${operation === "copy" ? "复制" : "移动"}歌曲到哪个歌单？\n` +
            (choices ? choices + "\n" : "暂无其他歌单。\n") +
            "输入目标歌单编号或已有歌单名称；也可输入新歌单名称。";

        const answer = prompt(promptText);
        if (answer === null) return null;

        const value = answer.trim();
        if (!value) {
            message.textContent = "未指定目标歌单。";
            return null;
        }

        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= available.length) {
            return { target: available[number - 1], isNew: false };
        }

        const existing = playlists.find(
            p => p.name.toLocaleLowerCase() === value.toLocaleLowerCase()
        );
        if (existing) {
            if (existing.id === source.id) {
                message.textContent = "不能将歌曲复制或移动到同一个歌单。";
                return null;
            }
            return { target: existing, isNew: false };
        }

        if (playlists.some(p => p.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
            message.textContent = "目标歌单名称无效。";
            return null;
        }

        return {
            target: { id: makeId(), name: value, songs: [], loopEnabled: false },
            isNew: true
        };
    }

    function copySongWithDestination(source, index) {
        const song = source.songs[index];
        if (!song) return;

        const answer = prompt(
            "复制歌曲到哪里？\n1. 导入播放列表（主页播放器列表）\n2. 复制到其他自定义歌单",
            "1"
        );
        if (answer === null) return;

        const choice = answer.trim();
        if (choice === "1" || choice === "导入播放列表" || choice === "播放列表") {
            if (typeof window.addBrowseSongToPlaylist !== "function") {
                message.textContent = "主页播放列表接口尚未加载，请刷新页面后重试。";
                return;
            }
            window.addBrowseSongToPlaylist(song);
            return;
        }
        if (choice === "2" || choice === "自定义歌单") {
            transferSong(source, index, "copy");
            return;
        }
        message.textContent = "输入无效，请输入 1 或 2。";
    }

    function transferSong(source, index, operation) {
        const song = source.songs[index];
        if (!song) return;

        const choice = chooseTransferTarget(source, operation);
        if (!choice) return;

        const target = choice.target;
        const originalPlaylists = [...playlists];
        const sourceSongs = [...source.songs];
        const targetSongs = [...target.songs];

        if (choice.isNew) playlists.push(target);

        const duplicate = target.songs.some(item => songKey(item) === songKey(song));
        if (duplicate && operation === "copy") {
            if (choice.isNew) playlists = originalPlaylists;
            message.textContent = `目标歌单“${target.name}”已经有这首歌，没有重复添加。`;
            render();
            return;
        }

        if (!duplicate) target.songs.push({ ...song });
        if (operation === "move") {
            const currentIndex = source.songs.findIndex(item => item === song);
            if (currentIndex >= 0) source.songs.splice(currentIndex, 1);
        }

        selectedId = target.id;
        if (!save()) {
            source.songs = sourceSongs;
            target.songs = targetSongs;
            playlists = originalPlaylists;
            selectedId = source.id;
            render();
            return;
        }

        message.textContent = operation === "copy"
            ? `已复制歌曲到“${target.name}”，源歌单保持不变。`
            : `已将歌曲移动到“${target.name}”。`;
        render();
    }

    function createPlaylist(prefillName = "") {
        const input = prompt("请输入新歌单名称：", prefillName);
        if (input === null) return null;
        const name = input.trim();
        if (!name) {
            message.textContent = "歌单名称不能为空。";
            return null;
        }
        if (playlists.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            message.textContent = "已有同名歌单，请使用其他名称。";
            return null;
        }
        const playlist = { id: makeId(), name, songs: [], loopEnabled: false };
        playlists.push(playlist);
        selectedId = playlist.id;
        if (!save()) {
            playlists.pop();
            selectedId = playlists[0]?.id || null;
            return null;
        }
        message.textContent = `已创建歌单“${name}”。`;
        render();
        return playlist;
    }

    function renamePlaylist(playlist) {
        const input = prompt("请输入新的歌单名称：", playlist.name);
        if (input === null) return;
        const name = input.trim();
        if (!name) {
            message.textContent = "歌单名称不能为空。";
            return;
        }
        if (playlists.some(p => p.id !== playlist.id &&
            p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            message.textContent = "已有同名歌单，请使用其他名称。";
            return;
        }
        const oldName = playlist.name;
        playlist.name = name;
        if (!save()) playlist.name = oldName;
        else message.textContent = "歌单已重命名。";
        render();
    }

    function deletePlaylist(playlist) {
        if (!confirm(`确定删除歌单“${playlist.name}”及其中的歌曲吗？此操作不会删除默认队列或收藏夹。`)) return;
        const index = playlists.findIndex(p => p.id === playlist.id);
        if (index < 0) return;
        const [removed] = playlists.splice(index, 1);
        selectedId = playlists[0]?.id || null;
        if (!save()) {
            playlists.splice(index, 0, removed);
            selectedId = removed.id;
            return;
        }
        // 仅在删除成功后通知播放器；是否正在播放由 app.js 统一判断。
        window.dispatchEvent(new CustomEvent("solara:custom-playlist-deleted", {
            detail: { playlistId: removed.id }
        }));
        message.textContent = `已删除歌单“${removed.name}”。`;
        render();
    }

    function addSong(song) {
        if (!song || typeof song !== "object") return;
        let playlist = selectedPlaylist();

        if (!playlists.length) {
            playlist = createPlaylist();
            if (!playlist) return;
        } else {
            const names = playlists.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
            const answer = prompt(
                `输入目标歌单编号，或输入新歌单名称：\n${names}`,
                playlist ? String(playlists.indexOf(playlist) + 1) : "1"
            );
            if (answer === null) return;
            const choice = answer.trim();
            const number = Number(choice);
            if (Number.isInteger(number) && number >= 1 && number <= playlists.length) {
                playlist = playlists[number - 1];
            } else {
                playlist = playlists.find(p => p.name.toLocaleLowerCase() === choice.toLocaleLowerCase());
                if (!playlist) playlist = createPlaylist(choice);
                if (!playlist) return;
            }
        }

        const key = songKey(song);
        if (playlist.songs.some(existing => songKey(existing) === key)) {
            selectedId = playlist.id;
            message.textContent = `“${song.name || "该歌曲"}”已在歌单“${playlist.name}”中。`;
            showPanel();
            render();
            return;
        }

        playlist.songs.push(normalizeSong(song));
        selectedId = playlist.id;
        if (!save()) {
            playlist.songs.pop();
            return;
        }
        message.textContent = `已将“${song.name || "歌曲"}”添加到“${playlist.name}”。`;
        showPanel();
        render();
    }

    function showPanel() {
        panel.hidden = false;
        browsePanel.hidden = true;
        createNavButton.classList.add("is-active");
        createNavButton.setAttribute("aria-current", "page");
        nav.querySelectorAll("[data-browse-view]").forEach(button => {
            if (button !== createNavButton) {
                button.classList.remove("is-active");
                button.setAttribute("aria-current", "false");
            }
        });
    }

    nav.addEventListener("click", event => {
        const target = event.target.closest("[data-browse-view]");
        if (!target) return;
        if (target.dataset.browseView === "custom") {
            showPanel();
            render();
        } else {
            panel.hidden = true;
        }
    });

    panel.querySelector('[data-action="create"]').addEventListener("click", () => createPlaylist());
    window.addEventListener("solara:add-to-custom-playlist", event => addSong(event.detail?.song));


    window.SolaraCustomPlaylists = {
        getPlaylistById(id) {
            return playlists.find(playlist => playlist.id === id) || null;
        },

        getPlaylists() {
            return playlists.map(playlist => ({
                id: playlist.id,
                name: playlist.name,
                songCount: playlist.songs.length
            }));
        },

        addSongsToPlaylist(id, songs) {
            const target = playlists.find(playlist => playlist.id === id);
            if (!target) {
                return { ok: false, reason: "not-found", added: 0, duplicates: 0 };
            }
            if (!Array.isArray(songs)) {
                return { ok: false, reason: "invalid-songs", added: 0, duplicates: 0 };
            }

            const originalSongs = [...target.songs];
            const existingKeys = new Set(target.songs.map(songKey));
            let added = 0;
            let duplicates = 0;

            for (const rawSong of songs) {
                if (!rawSong || typeof rawSong !== "object") continue;
                const normalized = normalizeSong(rawSong);
                const key = songKey(normalized);

                if (existingKeys.has(key)) {
                    duplicates++;
                    continue;
                }

                target.songs.push(normalized);
                existingKeys.add(key);
                added++;
            }

            if (added > 0 && !save()) {
                target.songs = originalSongs;
                render();
                return { ok: false, reason: "save-failed", added: 0, duplicates };
            }

            selectedId = target.id;
            if (added > 0) {
                message.textContent = `已导入 ${added} 首歌曲到“${target.name}”。`;
                render();
            } else {
                message.textContent = `“${target.name}”中已包含所选歌曲。`;
            }

            return {
                ok: true,
                added,
                duplicates,
                playlistName: target.name
            };
        }
    };

    // 同一页面的其他标签可能仍然隐藏浏览面板，切换回自定义歌单时再显示。
    render();
})();
