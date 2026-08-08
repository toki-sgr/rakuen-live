// ==========================================================================
// modules/state.js — Shared Reactive Application State
// ==========================================================================

class Store {
    constructor(initialState) {
        this._state = { ...initialState };
        this._listeners = {};

        // Define reactive getters and setters for backwards compatibility
        Object.keys(initialState).forEach(key => {
            Object.defineProperty(this, key, {
                get: () => this._state[key],
                set: (value) => this.set(key, value),
                enumerable: true,
                configurable: true,
            });
        });
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        const oldVal = this._state[key];
        this._state[key] = value;
        if (this._listeners[key]) {
            this._listeners[key].forEach(fn => fn(value, oldVal));
        }
    }

    on(key, callback) {
        if (!this._listeners[key]) {
            this._listeners[key] = [];
        }
        this._listeners[key].push(callback);
        return () => {
            this._listeners[key] = this._listeners[key].filter(fn => fn !== callback);
        };
    }
}

export const appState = new Store({
    isEditMode: false,
    blogPostsData: [],      // Cached blog post list
    currentActivePost: null,
    foliosData: [],          // Cached novel list
    currentNovel: null,
    currentChapter: null,
});
