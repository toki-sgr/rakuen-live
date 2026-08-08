// ==========================================================================
// core/api.js — Content API client
//
// One resource() call per collection, mirroring the routes the backend
// generates from its models.
// ==========================================================================

// Set by core/edit.js when edit mode is unlocked. Kept here so the client has
// no dependency on the UI that collects it.
let authToken = '';

export function setAuthToken(token) {
    authToken = token || '';
}

async function request(url, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    // Only sent for writes; reads are public.
    if (method !== 'GET' && authToken) {
        headers['X-Edit-Password'] = authToken;
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error((data && data.error) || `请求失败 (HTTP ${res.status})`);
    }
    return data;
}

const query = (params) => {
    const search = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v)
    ).toString();
    return search ? `?${search}` : '';
};

/** The five standard routes for a collection. */
function resource(name) {
    const base = `/api/${name}`;
    return {
        list: () => request(base),
        get: (slug, params) => request(`${base}/${encodeURIComponent(slug)}${query(params)}`),
        create: (data) => request(base, { method: 'POST', body: data }),
        update: (slug, data) =>
            request(`${base}/${encodeURIComponent(slug)}`, { method: 'PUT', body: data }),
        remove: (slug, data = {}) =>
            request(`${base}/${encodeURIComponent(slug)}`, { method: 'DELETE', body: data }),
    };
}

export const posts = resource('posts');
export const books = resource('books');
export const albums = resource('albums');

/** Chapters are nested under a book and scoped to one of its volumes. */
const chapterUrl = (slug, number = '') =>
    `/api/books/${encodeURIComponent(slug)}/chapters${number === '' ? '' : `/${encodeURIComponent(number)}`}`;

export const chapters = {
    get: (slug, number, volume) => request(chapterUrl(slug, number) + query({ volume })),
    create: (slug, data) => request(chapterUrl(slug), { method: 'POST', body: data }),
    update: (slug, number, data) =>
        request(chapterUrl(slug, number), { method: 'PUT', body: data }),
    remove: (slug, number, volume) =>
        request(chapterUrl(slug, number), { method: 'DELETE', body: { volume } }),
};

export const verifyPassword = (password) =>
    request('/api/auth', { method: 'POST', body: { password } });
