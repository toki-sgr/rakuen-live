// Copy published content and site imagery into dist/, so the deployed site can
// serve the images and audio that frontmatter points at.
//
// Anything whose name starts with `_` is a working file — original exports,
// drafts, notes. It stays out of the build.

import fs from 'fs';
import path from 'path';

const DIRS = ['content', 'assets'];
const PRIVATE_PREFIX = '_';

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return { files: 0, skipped: 0 };
    fs.mkdirSync(dest, { recursive: true });

    let files = 0;
    let skipped = 0;

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.startsWith(PRIVATE_PREFIX)) {
            skipped += 1;
            continue;
        }
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            const inner = copyDir(from, to);
            files += inner.files;
            skipped += inner.skipped;
        } else if (entry.name.endsWith('.md')) {
            // Markdown is delivered as JSON by the API, never as a raw file.
            skipped += 1;
        } else {
            fs.copyFileSync(from, to);
            files += 1;
        }
    }
    return { files, skipped };
}

const total = DIRS.reduce((sum, dir) => {
    const { files, skipped } = copyDir(dir, path.join('dist', dir));
    console.log(`  ${dir}/  ${files} files copied, ${skipped} skipped`);
    return sum + files;
}, 0);

console.log(`Copied ${total} files into dist/.`);
