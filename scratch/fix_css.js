const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');

// Remove previously added new design system classes
const marker = '/* ========================================\n   NEW DESIGN SYSTEM CLASSES';
if (css.includes(marker)) {
  css = css.split(marker)[0];
}

const updatedStyles = `
/* ========================================
   NEW DESIGN SYSTEM CLASSES
   ======================================== */
.new-layout-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
}

/* HERO SECTION */
.hero-new {
  position: relative;
  min-height: 500px;
  margin-top: var(--space-2xl);
  margin-bottom: var(--space-3xl);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: radial-gradient(circle at 70% 50%, rgba(255, 179, 0, 0.08) 0%, rgba(0, 0, 0, 0) 60%);
}

.hero-image-bg {
  position: absolute;
  top: -50px;
  right: -100px;
  width: 800px;
  height: 800px;
  z-index: 0;
  pointer-events: none;
}

.hero-image-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, var(--bg-primary) 30%, transparent 70%);
  z-index: 1;
}

.hero-content-wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3xl) var(--space-2xl);
  min-height: 500px;
}

.hero-left-col {
  max-width: 550px;
}

.hero-right-col {
  width: 340px;
  margin-right: var(--space-xl);
}

.hero-new-title {
  font-size: 64px;
  font-weight: 800;
  line-height: 1.05;
  text-transform: uppercase;
  margin-bottom: var(--space-md);
  letter-spacing: -1px;
}

.hero-new-title span {
  color: var(--accent-gold);
}

.hero-new-desc {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: var(--space-xl);
  line-height: 1.6;
}

.hero-new-buttons {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-2xl);
}

.btn-primary {
  background: var(--accent-gradient);
  color: var(--bg-primary);
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  text-decoration: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-gold);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  text-decoration: none;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--text-secondary);
}

.hero-stats {
  display: flex;
  gap: var(--space-xl);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0,0,0,0.4);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  min-width: 120px;
}

.stat-item-value {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 700;
  font-size: 15px;
  color: var(--accent-gold);
}

.stat-item-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

/* PREMIUM BOX */
.premium-box {
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 179, 0, 0.3);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
}

.premium-box-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.premium-box-header h3 {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
}

.crown-icon {
  font-size: 20px;
  color: var(--accent-gold);
}

.premium-box-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--space-lg);
}

.premium-features-list {
  list-style: none;
  margin-bottom: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.premium-features-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-primary);
}

.check-icon {
  color: var(--accent-gold);
}

.btn-premium-upgrade {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: transparent;
  color: var(--accent-gold);
  border: 1px solid var(--accent-gold);
  padding: 12px;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  transition: all var(--transition-fast);
  margin-bottom: var(--space-sm);
}

.btn-premium-upgrade:hover {
  background: rgba(255, 179, 0, 0.1);
  box-shadow: 0 0 15px rgba(255, 179, 0, 0.2);
}

.premium-price-hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary);
}

/* MAIN GRID */
.main-grid {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  gap: var(--space-2xl);
  padding-bottom: var(--space-3xl);
}

/* SIDEBAR */
.sidebar-menu {
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
}

.sidebar-title {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--space-md);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

.sidebar-icon {
  font-size: 16px;
  color: var(--accent-gold);
}

.sidebar-item:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.sidebar-item.active {
  background: rgba(255, 179, 0, 0.1);
  color: var(--accent-gold);
  border-color: rgba(255, 179, 0, 0.2);
}

/* DISCORD CARD */
.discord-join-card {
  background: #1e1f2b;
  border: 1px solid #2f3146;
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.discord-join-card:hover {
  border-color: #5865f2;
  box-shadow: 0 0 20px rgba(88, 101, 242, 0.2);
  transform: translateY(-2px);
}

.discord-icon-wrapper {
  background: #5865f2;
  padding: 10px;
  border-radius: 10px;
  display: flex;
}

.discord-text {
  flex: 1;
}

.discord-title {
  font-size: 12px;
  font-weight: 800;
  color: white;
  margin-bottom: 2px;
}

.discord-subtitle {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
}

.discord-arrow {
  color: #5865f2;
  font-size: 20px;
}

/* CARDS GRID */
.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border-color);
}

.content-title {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--accent-gold);
  font-weight: 700;
}

.view-all {
  color: var(--text-secondary);
  font-size: 12px;
  text-decoration: none;
}
.view-all:hover { color: var(--text-primary); }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-lg);
}

.new-tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all var(--transition-normal);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.new-tool-card:hover {
  border-color: rgba(255, 179, 0, 0.4);
  background: var(--bg-card-hover);
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.new-tool-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.new-tool-icon {
  font-size: 32px;
  background: rgba(0,0,0,0.3);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.new-tool-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 1px;
}
.badge-green { background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.2); }
.badge-purple { background: rgba(155, 89, 182, 0.1); color: #9b59b6; border: 1px solid rgba(155, 89, 182, 0.2); }

.new-tool-content {
  flex: 1;
}

.new-tool-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.new-tool-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-xl);
}

.new-tool-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

/* RIGHT SIDEBAR ACTIVITY */
.activity-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.activity-item {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.activity-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.activity-icon {
  background: rgba(0,0,0,0.5);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.activity-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.activity-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.status-indicator {
  margin-top: var(--space-md);
  background: rgba(39, 174, 96, 0.05);
  border: 1px solid rgba(39, 174, 96, 0.2);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 12px;
  height: 12px;
  background: #2ecc71;
  border-radius: 50%;
  box-shadow: 0 0 15px #2ecc71;
}

.status-text {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.status-text span {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #2ecc71;
  margin-top: 2px;
}

/* COMMUNITY BANNER */
.community-banner {
  background: linear-gradient(90deg, rgba(255, 179, 0, 0.15) 0%, rgba(26, 26, 26, 1) 100%);
  border: 1px solid rgba(255, 179, 0, 0.3);
  border-radius: var(--radius-lg);
  padding: 24px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.community-banner-left {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.banner-trophy {
  font-size: 48px;
  filter: drop-shadow(0 0 15px rgba(255, 179, 0, 0.4));
}

.banner-content h3 {
  font-size: 18px;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.banner-content p {
  font-size: 13px;
  color: var(--text-secondary);
}

.banner-right {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
}
`;

fs.writeFileSync('src/app/globals.css', css + '\n' + updatedStyles);
console.log('Styles overwritten successfully.');
