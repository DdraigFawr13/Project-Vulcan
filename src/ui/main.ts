import { startRenderer } from '../render/index.ts';

const parent = document.getElementById('game');
if (!parent) throw new Error('index.html is missing #game');
startRenderer(parent);
