// ==========================================================================
// components/photoWall.js — The sidebar artwork, cycled on click
// ==========================================================================

import { site } from '../../data/site.js';

/** Wait for a transition, with a timeout so a dropped event cannot wedge it. */
function afterTransition(node, callback, timeoutMs = 400) {
    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        node.removeEventListener('transitionend', finish);
        callback();
    };
    node.addEventListener('transitionend', finish);
    setTimeout(finish, timeoutMs);
}

export function initPhotoWall(wall) {
    const image = wall && wall.querySelector('img');
    if (!image || site.photoWall.length < 2) return;

    let index = 0;
    let busy = false;

    wall.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        image.classList.add('fade-out');

        afterTransition(image, () => {
            index = (index + 1) % site.photoWall.length;
            const next = site.photoWall[index];

            const preload = new Image();
            preload.src = next;
            const reveal = (src) => {
                if (src) image.src = src;
                image.classList.remove('fade-out');
                busy = false;
            };
            preload.onload = () => reveal(next);
            preload.onerror = () => reveal(null);
        }, 350);
    });
}
