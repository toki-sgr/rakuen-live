// ==========================================================================
// views/music.js — 星火倾斜
//
// The album being browsed and the track being played are tracked separately,
// so paging through the shelf never disturbs playback.
// ==========================================================================

import * as api from '../core/api.js';
import { fill, h, icon, qs } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { failed, loading } from '../components/states.js';
import { sections } from '../../data/site.js';

const PLACEHOLDER = '/assets/ruined_library.png';
const LOOP_MODES = [
    { id: 'all', icon: 'fa-solid fa-repeat', title: '循环模式: 列表循环', highlight: false },
    { id: 'one', icon: 'fa-solid fa-rotate-right', title: '循环模式: 单曲循环', highlight: true },
    { id: 'shuffle', icon: 'fa-solid fa-shuffle', title: '循环模式: 随机播放', highlight: true },
];

const audio = new Audio();
audio.preload = 'metadata';

let albums = [];
let viewing = 0;
let playing = { album: -1, track: -1 };
let loop = 0;
let minimized = false;
let seeking = false;

const cards = new Map(); // track index -> { node, playIcon } for the viewed album

const clock = (seconds) => {
    if (!Number.isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ==========================================================================
// Music room
// ==========================================================================
const heroTitle = h('h3');
const heroQuote = h('p.music-hero-quote');
const heroCover = h('img.vinyl-center-img', {
    src: PLACEHOLDER,
    alt: 'Album Art',
    onError: (e) => { e.target.src = PLACEHOLDER; },
});
const heroVinyl = h('div.music-vinyl-record', {}, h('div.vinyl-grooves'), heroCover);
const albumBadge = h('span.album-indicator-badge');
const trackList = h('div.music-tracks-grid');

const prevAlbum = h('button#btn-album-prev.btn-album-nav', {
    title: '上一张专辑',
    onClick: () => { if (viewing > 0) { viewing -= 1; renderRoom(); } },
}, icon('fa-solid fa-chevron-left'));

const nextAlbum = h('button#btn-album-next.btn-album-nav', {
    title: '下一张专辑',
    onClick: () => { if (viewing < albums.length - 1) { viewing += 1; renderRoom(); } },
}, icon('fa-solid fa-chevron-right'));

const playAll = h('button.btn-primary', {
    onClick: () => albums[viewing] && albums[viewing].tracks.length && play(viewing, 0),
}, icon('fa-solid fa-play'), ' 播放全部曲目');

const room = [
    h('div.section-header', {},
        h('h2', {}, sections.music.title),
        h('p.section-subtitle', {}, sections.music.subtitle),
    ),
    h('div.music-hero-card', {},
        prevAlbum,
        h('div.music-vinyl-wrapper', {}, heroVinyl),
        h('div.music-hero-info', {},
            h('div.music-tag-row', {},
                h('span.music-tag', {}, icon('fa-solid fa-compact-disc'), ' 音乐合集'),
                albumBadge,
            ),
            heroTitle,
            heroQuote,
            h('div.music-hero-actions', {}, playAll),
        ),
        nextAlbum,
    ),
    h('div.music-tracks-header', {}, h('h3', {}, icon('fa-solid fa-list-ul'), ' 曲目列表')),
    trackList,
];

function trackCard(track, index) {
    const playIcon = icon('fa-solid fa-play');
    const when = track.note;

    const node = h('div.music-track-card', {
        dataset: { track: track.slug },
        onClick: () => (isPlaying(viewing, index) ? toggle() : play(viewing, index)),
    },
        h('span.track-num-badge', {}, `#${track.number}`),
        h('img.track-cover-thumb', {
            src: track.cover || PLACEHOLDER,
            alt: track.title,
            onError: (e) => { e.target.src = PLACEHOLDER; },
        }),
        h('div.track-info-body', {},
            h('div.track-title', { title: track.title }, track.title),
            h('div.track-meta-row', {},
                h('span.meta-item', {}, icon('fa-regular fa-user'), ` ${track.artist}`),
                h('span.meta-item.track-duration', {}, icon('fa-regular fa-clock'), ` ${track.duration || '--:--'}`),
            ),
            track.quote ? h('div.track-meta-row.quote-row', {},
                // Full text on hover, since a long quote is truncated here.
                h('span.track-quote', { title: track.quote }, track.quote),
            ) : null,
            when ? h('div.track-meta-row.history-row', {},
                h('span.meta-item.history-tag', {}, icon('fa-solid fa-location-dot'), ` ${when}`),
            ) : null,
        ),
        h('button.btn-track-play', { title: '播放' }, playIcon),
    );

    cards.set(index, { node, playIcon });
    return node;
}

function renderRoom() {
    const album = albums[viewing];
    if (!album) return;

    fill(heroTitle, album.title);
    fill(heroQuote, `“${album.summary}”`);
    heroCover.src = album.cover || PLACEHOLDER;
    fill(albumBadge, `${viewing + 1} / ${albums.length}`);
    prevAlbum.disabled = viewing === 0;
    nextAlbum.disabled = viewing === albums.length - 1;

    cards.clear();
    fill(trackList, album.tracks.map(trackCard));
    syncPlaybackUI();
}

/**
 * Repaint everything playback state affects, leaving the cards in place.
 *
 * Both records and both play buttons are driven from here, so the bar can
 * never disagree with the track list about what is playing.
 */
function syncPlaybackUI() {
    const active = !audio.paused;

    for (const [index, { node, playIcon }] of cards) {
        const current = isPlaying(viewing, index);
        node.classList.toggle('active-playing', current);
        playIcon.className = `fa-solid ${current && active ? 'fa-pause' : 'fa-play'}`;
    }

    heroVinyl.classList.toggle('playing', active && playing.album === viewing);
    barVinyl.classList.toggle('playing', active);
    barPlayIcon.className = `fa-solid ${active ? 'fa-pause' : 'fa-play'}`;
}

// ==========================================================================
// Player bar
// ==========================================================================
const barTitle = h('div.player-track-title', {}, '未在播放');
const barArtist = h('div.player-track-artist', {}, 'toki');
const barCover = h('img', {
    src: PLACEHOLDER,
    alt: 'Track Cover',
    onError: (e) => { e.target.src = PLACEHOLDER; },
});
const barVinyl = h('div.player-vinyl-disc', {}, barCover);
const barPlayIcon = icon('fa-solid fa-play');
const elapsed = h('span.player-time', {}, '00:00');
const total = h('span.player-time', {}, '00:00');

const seek = h('input.player-seek-slider', { type: 'range', min: 0, max: 100, value: 0, step: 0.1 });
const volume = h('input.volume-slider', { type: 'range', min: 0, max: 1, step: 0.05, value: 0.8 });
const volumeIcon = icon('fa-solid fa-volume-high');
const minimizeIcon = icon('fa-solid fa-compress');

const loopButton = h('button.btn-player-ctrl', {
    title: LOOP_MODES[0].title,
    onClick: () => {
        loop = (loop + 1) % LOOP_MODES.length;
        const mode = LOOP_MODES[loop];
        loopButton.title = mode.title;
        loopButton.classList.toggle('active-loop', mode.highlight);
        fill(loopButton, icon(mode.icon));
    },
}, icon(LOOP_MODES[0].icon));

const bar = h('div#global-audio-player.global-player-bar.hidden', {},
    h('div.player-container', {},
        h('div.player-track-info', {
            onClick: () => { if (minimized) setMinimized(false); },
        }, barVinyl, h('div.player-text-details', {}, barTitle, barArtist)),

        h('div.player-controls', {},
            h('div.player-buttons', {},
                loopButton,
                h('button.btn-player-ctrl', { title: '上一首', onClick: () => step(-1) },
                    icon('fa-solid fa-backward-step')),
                h('button.btn-player-play', { title: '播放/暂停', onClick: toggle }, barPlayIcon),
                h('button.btn-player-ctrl', { title: '下一首', onClick: () => step(1) },
                    icon('fa-solid fa-forward-step')),
            ),
            h('div.player-progress-wrapper', {}, elapsed, seek, total),
        ),

        h('div.player-extra-controls', {},
            h('div.player-volume-wrapper', {},
                h('button.btn-player-ctrl', {
                    title: '静音/音量',
                    onClick: () => {
                        audio.muted = !audio.muted;
                        volumeIcon.className = audio.muted
                            ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
                    },
                }, volumeIcon),
                volume,
            ),
            h('button.btn-player-ctrl', { title: '最小化/展开', onClick: () => setMinimized(!minimized) },
                minimizeIcon),
            h('button.btn-player-ctrl', {
                title: '关闭播放器',
                onClick: () => {
                    audio.pause();
                    bar.classList.add('hidden');
                    setMinimized(false);
                },
            }, icon('fa-solid fa-xmark')),
        ),
    ),
);

function setMinimized(next) {
    minimized = next;
    bar.classList.toggle('minimized', minimized);
    minimizeIcon.className = minimized ? 'fa-solid fa-expand' : 'fa-solid fa-compress';
}

// ==========================================================================
// Playback
// ==========================================================================
const isPlaying = (albumIndex, trackIndex) =>
    playing.album === albumIndex && playing.track === trackIndex;

const currentTrack = () => {
    const album = albums[playing.album];
    return album ? album.tracks[playing.track] : null;
};

function play(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    const track = album && album.tracks[trackIndex];
    if (!track) return;

    playing = { album: albumIndex, track: trackIndex };
    audio.src = track.audio;
    audio.play().catch(() => { /* autoplay policies; the play button still works */ });

    fill(barTitle, track.title);
    fill(barArtist, `${track.artist} · ${album.title}`);
    barCover.src = track.cover || PLACEHOLDER;
    bar.classList.remove('hidden');
    syncPlaybackUI();
}

function toggle() {
    if (!audio.src) {
        if (albums[viewing] && albums[viewing].tracks.length) play(viewing, 0);
        return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
}

function step(direction) {
    const album = albums[playing.album];
    if (!album || !album.tracks.length) return;

    if (direction > 0 && LOOP_MODES[loop].id === 'shuffle') {
        play(playing.album, Math.floor(Math.random() * album.tracks.length));
        return;
    }
    const count = album.tracks.length;
    play(playing.album, (playing.track + direction + count) % count);
}

audio.addEventListener('play', syncPlaybackUI);
audio.addEventListener('pause', syncPlaybackUI);

audio.addEventListener('error', () => {
    // A track whose audio_url points at nothing would otherwise just sit there.
    if (!audio.src) return;
    const track = currentTrack();
    toast(`无法播放《${track ? track.title : '该曲目'}》，音频文件可能不存在`, 'error');
    syncPlaybackUI();
});

audio.addEventListener('ended', () => {
    if (LOOP_MODES[loop].id === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } else {
        step(1);
    }
});

audio.addEventListener('loadedmetadata', () => {
    // Fill in a duration the frontmatter did not declare, rather than showing
    // a made-up one.
    const track = currentTrack();
    if (track && !track.duration && Number.isFinite(audio.duration)) {
        track.duration = clock(audio.duration);
        if (playing.album === viewing) {
            const card = cards.get(playing.track);
            const label = card && qs('.track-duration', card.node);
            if (label) fill(label, icon('fa-regular fa-clock'), ` ${track.duration}`);
        }
    }
    updateProgress();
});

audio.addEventListener('timeupdate', updateProgress);

function updateProgress() {
    if (seeking || !Number.isFinite(audio.duration) || !audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    seek.value = percent;
    seek.style.setProperty('--seek-percent', `${percent}%`);
    fill(elapsed, clock(audio.currentTime));
    fill(total, clock(audio.duration));
}

for (const event of ['mousedown', 'touchstart', 'pointerdown']) {
    seek.addEventListener(event, () => { seeking = true; }, { passive: true });
}

seek.addEventListener('input', () => {
    seeking = true;
    const percent = parseFloat(seek.value);
    seek.style.setProperty('--seek-percent', `${percent}%`);
    if (Number.isFinite(audio.duration)) fill(elapsed, clock((percent / 100) * audio.duration));
});

seek.addEventListener('change', () => {
    const percent = parseFloat(seek.value);
    if (Number.isFinite(audio.duration) && audio.duration) {
        audio.currentTime = (percent / 100) * audio.duration;
    }
    seeking = false;
});

volume.addEventListener('input', () => {
    audio.volume = parseFloat(volume.value);
    audio.muted = audio.volume === 0;
    volumeIcon.className = audio.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
});

audio.volume = parseFloat(volume.value);

// ==========================================================================
let loaded = null;

async function loadAlbums() {
    fill(trackList, loading('正在加载专辑...'));
    try {
        albums = await api.albums.list();
    } catch {
        fill(trackList, failed('加载专辑失败'));
        return;
    }
    renderRoom();
}

export default {
    id: 'music',
    nav: { icon: 'fa-solid fa-compact-disc', label: '星火倾斜 / Music', short: '星火倾斜' },

    render() {
        // The bar outlives the tab: it keeps playing while you read elsewhere.
        document.body.appendChild(bar);
        return room;
    },

    route() {
        loaded = loaded || loadAlbums();
    },
};
