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

// Font Awesome Free has no repeat-one glyph, so the loop with a 1 inside it is
// drawn here rather than approximated with a different icon.
const REPEAT_ONE = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
  <path fill="currentColor" d="M13 15V9h-1l-2 1v1h1.5v4H13z"/>
</svg>`;

const LOOP_MODES = [
    { id: 'all', icon: 'fa-solid fa-repeat', title: '循环模式: 列表循环', highlight: false },
    { id: 'one', svg: REPEAT_ONE, title: '循环模式: 单曲循环', highlight: true },
    { id: 'shuffle', icon: 'fa-solid fa-shuffle', title: '循环模式: 随机播放', highlight: true },
];

/** A loop mode's glyph, whether it comes from the icon font or from above. */
const loopGlyph = (mode) =>
    mode.svg ? h('span.player-glyph', { html: mode.svg }) : icon(mode.icon);

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
const albumMeta = h('div.album-meta');
const albumDots = h('div.album-dots');
const trackList = h('div.music-tracklist');
const tracksCount = h('span.tracks-count');

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
            albumMeta,
            h('div.music-hero-actions', {}, playAll, albumDots),
        ),
        nextAlbum,
    ),
    h('div.music-tracks-header', {},
        h('h3', {}, icon('fa-solid fa-list-ul'), ' 曲目列表'),
        tracksCount,
    ),
    trackList,
];

/**
 * One row of the tracklist.
 *
 * A single column, like every other list on the site, rather than a grid of
 * cards: it puts the title, its line and its duration on one baseline and
 * scales to an album of any length.
 */
function trackRow(track, index, album) {
    const playIcon = icon('fa-solid fa-play');

    // Three bars that animate while this track is the one playing.
    const bars = h('span.track-bars', {}, h('i'), h('i'), h('i'));
    const number = h('span.track-number', {}, track.number);
    const indicator = h('div.track-index', {}, number, bars);

    // The thumbnail earns its place only when the track has art of its own.
    const ownArt = track.cover && track.cover !== album.cover;

    const node = h('div.track-row', {
        dataset: { track: track.slug },
        role: 'button',
        tabindex: '0',
        onClick: () => (isPlaying(viewing, index) ? toggle() : play(viewing, index)),
        onKeydown: (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            isPlaying(viewing, index) ? toggle() : play(viewing, index);
        },
    },
        indicator,
        ownArt ? h('img.track-cover-thumb', {
            src: track.cover,
            alt: track.title,
            onError: (e) => { e.target.remove(); },
        }) : null,
        h('div.track-main', {},
            h('div.track-title', { title: track.title }, track.title),
            (track.quote || track.note) ? h('div.track-sub', {},
                track.quote ? h('span.track-quote', { title: track.quote }, track.quote) : null,
                track.note ? h('span.track-note', {}, icon('fa-solid fa-location-dot'), ` ${track.note}`) : null,
            ) : null,
        ),
        // An unknown duration shows nothing rather than a row of dashes; it
        // fills itself in from the audio the first time the track is played.
        h('span.track-time', {}, track.duration || ''),
        h('button.btn-track-play', {
            title: '播放',
            tabindex: '-1',
            'aria-hidden': 'true',
        }, playIcon),
    );

    cards.set(index, { node, playIcon });
    return node;
}

/** Clickable dots so you can see how many albums there are and jump to one. */
function renderAlbumDots() {
    fill(albumDots, albums.map((album, index) =>
        h('button.album-dot', {
            class: index === viewing ? 'is-current' : null,
            title: album.title,
            'aria-label': album.title,
            onClick: () => { viewing = index; renderRoom(); },
        }),
    ));
}

function renderRoom() {
    const album = albums[viewing];
    if (!album) return;

    fill(heroTitle, album.title);
    fill(heroQuote, album.summary ? `“${album.summary}”` : '');
    heroCover.src = album.cover || PLACEHOLDER;
    fill(albumBadge, `${viewing + 1} / ${albums.length}`);

    fill(albumMeta, [album.year, `${album.tracks.length} 首`].filter(Boolean).join(' · '));
    fill(tracksCount, `${album.tracks.length} 首`);

    prevAlbum.disabled = viewing === 0;
    nextAlbum.disabled = viewing === albums.length - 1;
    playAll.disabled = album.tracks.length === 0;

    renderAlbumDots();

    cards.clear();
    fill(trackList, album.tracks.length
        ? album.tracks.map((track, index) => trackRow(track, index, album))
        : h('div.loading-state', {}, '这张专辑还没有曲目。'));
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
        // The level meter only animates while sound is actually coming out.
        node.classList.toggle('is-running', current && active);
        playIcon.className = `fa-solid ${current && active ? 'fa-pause' : 'fa-play'}`;
    }

    heroVinyl.classList.toggle('playing', active && playing.album === viewing);
    barVinyl.classList.toggle('playing', active);
    barPlayIcon.className = `fa-solid ${active ? 'fa-pause' : 'fa-play'}`;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = active ? 'playing' : 'paused';
    }
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

const loopButton = h('button#btn-player-loop.btn-player-ctrl', {
    title: LOOP_MODES[0].title,
    onClick: () => {
        loop = (loop + 1) % LOOP_MODES.length;
        const mode = LOOP_MODES[loop];
        loopButton.title = mode.title;
        loopButton.classList.toggle('active-loop', mode.highlight);
        fill(loopButton, loopGlyph(mode));
    },
}, loopGlyph(LOOP_MODES[0]));

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
            h('button#btn-player-minimize.btn-player-ctrl', {
                title: '最小化/展开',
                onClick: () => setMinimized(!minimized),
            }, minimizeIcon),
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
    publishToOs(track, album);
    syncPlaybackUI();
}

/**
 * Hand the current track to the operating system.
 *
 * This is what makes the keyboard's media keys, the lock screen and the
 * headphone buttons work — without it the browser has nothing to show.
 */
function publishToOs(track, album) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: album.title,
        artwork: [{ src: new URL(track.cover || PLACEHOLDER, location.origin).href, sizes: '512x512' }],
    });

    const handlers = {
        play: () => audio.play().catch(() => {}),
        pause: () => audio.pause(),
        previoustrack: () => step(-1),
        nexttrack: () => step(1),
        seekbackward: () => { audio.currentTime = Math.max(0, audio.currentTime - 10); },
        seekforward: () => { audio.currentTime = audio.currentTime + 10; },
    };

    for (const [action, handler] of Object.entries(handlers)) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch {
            // Older browsers reject actions they do not implement.
        }
    }
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

audio.addEventListener('play', () => {
    // Closing the bar only dismisses it; anything that starts sound again
    // brings it back, including the same track, the media keys and autoplay
    // of the next track.
    bar.classList.remove('hidden');
    syncPlaybackUI();
});

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
            const label = card && qs('.track-time', card.node);
            if (label) fill(label, track.duration);
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
