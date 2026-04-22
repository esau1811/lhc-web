'use client';

import Link from 'next/link';

export default function Footer({ highlight = 'tools' }) {
  return (
    <footer className="footer">
      lhc<span>{highlight}</span> © {new Date().getFullYear()}
      <span className="separator">·</span>
      <a href="https://discord.gg/AS46Hlp2vO" target="_blank" rel="noopener noreferrer">
        Discord
      </a>
      <span className="separator">·</span>
      <Link href="/">← Back to tools</Link>
    </footer>
  );
}
