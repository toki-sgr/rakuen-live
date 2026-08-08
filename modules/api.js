// ==========================================================================
// modules/api.js — Centralized API Client
// All fetch calls go through apiFetch() for unified cache-busting and
// error handling. Exposes namespaced API objects: API.posts, API.novels.
// ==========================================================================

const CACHE_BUST = () => `_t=${Date.now()}`;

/**
 * Core fetch wrapper with unified error handling.
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<any>}
 */
async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// Shared auth payload helper
const withAuth = (body) => ({
    password: sessionStorage.getItem('rakuen_auth_token') || '',
    ...body,
});

// --------------------------------------------------------------------------
// Auth API
// --------------------------------------------------------------------------
export const AuthAPI = {
    verify(password) {
        return apiFetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
    },
};

// --------------------------------------------------------------------------
// Blog Posts API
// --------------------------------------------------------------------------
export const PostsAPI = {
    list() {
        return apiFetch(`/api/posts?${CACHE_BUST()}`);
    },
    get(slug) {
        return apiFetch(`/api/posts/${slug}?${CACHE_BUST()}`);
    },
    create(data) {
        return apiFetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    update(slug, data) {
        return apiFetch(`/api/posts/${slug}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    delete(slug) {
        return apiFetch(`/api/posts/${slug}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth({})),
        });
    },
};

// --------------------------------------------------------------------------
// Novels API
// --------------------------------------------------------------------------
export const NovelsAPI = {
    list() {
        return apiFetch(`/api/novels?${CACHE_BUST()}`);
    },
    get(slug, sideSlug = null) {
        const query = sideSlug
            ? `?${CACHE_BUST()}&side=${sideSlug}`
            : `?${CACHE_BUST()}`;
        return apiFetch(`/api/novels/${slug}${query}`);
    },
    create(data) {
        return apiFetch('/api/novels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    update(slug, data) {
        return apiFetch(`/api/novels/${slug}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    delete(slug) {
        return apiFetch(`/api/novels/${slug}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth({})),
        });
    },
};

// --------------------------------------------------------------------------
// Chapters API
// --------------------------------------------------------------------------
export const ChaptersAPI = {
    get(novelSlug, chapterNum, sideSlug = null) {
        const query = sideSlug
            ? `?${CACHE_BUST()}&side=${sideSlug}`
            : `?${CACHE_BUST()}`;
        return apiFetch(`/api/novels/${novelSlug}/chapters/${chapterNum}${query}`);
    },
    create(novelSlug, data) {
        return apiFetch(`/api/novels/${novelSlug}/chapters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    update(novelSlug, chapterNum, data) {
        return apiFetch(`/api/novels/${novelSlug}/chapters/${chapterNum}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(withAuth(data)),
        });
    },
    delete(novelSlug, chapterNum, sideSlug = null) {
        const body = withAuth(sideSlug ? { side: sideSlug } : {});
        return apiFetch(`/api/novels/${novelSlug}/chapters/${chapterNum}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    },
};
