import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Motion system first: design tokens, then the button effects that consume them.
// The site's own stylesheet loads last so it can layer on top.
import './motion/motion.tokens.css';
import './motion/motion.buttons.css';
import './styles/index.css';
// Side-effect IIFE — publishes window.MotionButtons, no exports.
// @ts-ignore: plain JS drop-in, intentionally untyped
import './motion/motion.buttons.js';

import App from './App';

const host = document.getElementById('root');
if (!host) throw new Error('#root missing');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
