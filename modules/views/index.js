// ==========================================================================
// views/index.js — The tab registry
//
// Order here is the order of the navigation. Adding a tab means writing one
// view module and adding it to this list; nothing else knows about tabs.
//
// A view is:
//   id      URL segment and section id
//   nav     { icon, label, short } for the sidebar and the mobile bar
//   render  () => Node, called once when the shell is built
//   route   (segments) => void, called whenever the hash resolves here
// ==========================================================================

import hub from './hub.js';
import about from './about.js';
import blog from './blog.js';
import folios from './folios/index.js';
import music from './music.js';

export const views = [hub, about, blog, folios, music];
