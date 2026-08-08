// ==========================================================================
// main.js — Application Entry Point
// Imports and initializes all feature modules.
// ==========================================================================

import { initTabs, initPasswordModal, initPhotoWall, initGlobalEditToggle } from './modules/ui.js';
import { initBlog, updateBlogEditModeUI } from './modules/blog.js';
import { initFolios, updateFoliosEditModeUI } from './modules/folios.js';
import { initRouter, handleHashRouting } from './modules/router.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configure Marked parser with Highlight.js code highlighting if available
    if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
        marked.setOptions({
            highlight: function (code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (_) {}
                }
                try {
                    return hljs.highlightAuto(code).value;
                } catch (_) {}
                return code;
            },
        });
    }

    // Core UI (tabs, password modal, sidebar image)
    initTabs();
    initPasswordModal();
    initPhotoWall();

    // Feature modules
    initBlog();
    initFolios();

    // Edit mode toggle — callbacks sync UI across blog & folios
    initGlobalEditToggle(
        /* onEnter */ () => {
            updateBlogEditModeUI();
            updateFoliosEditModeUI();
        },
        /* onExit */ () => {
            updateBlogEditModeUI();
            updateFoliosEditModeUI();
        }
    );

    // Hash routing (listen for changes + initial dispatch)
    initRouter();
    handleHashRouting();
});
