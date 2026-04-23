const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');

const additionalStyles = `

/* ========================================
   NEW DESIGN SYSTEM CLASSES
   ======================================== */
.new-layout-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
}

.hero-new {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3xl) 0;
  min-height: 400px;
  position: relative;
}

.hero-new-content {
  flex: 1;
  max-width: 600px;
  z-index: 2;
}

.hero-new-title {
  font-size: 56px;
  font-weight: 800;
  line-height: 1.1;
  text-transform: uppercase;
  margin-bottom: var(--space-md);
}

.hero-new-title span {
  color: var(--accent-gold);
}

.hero-new-desc {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: var(--space-xl);
  max-width: 400px;
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
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-gold);
}

.btn-secondary {
  background: transparent;
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
}

.btn-secondary:hover {
  border-color: var(--text-primary);
  background: rgba(255,255,255,0.05);
}

.hero-stats {
  display: flex;
  gap: var(--space-xl);
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-lg);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item-value {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 700;
  font-size: 16px;
  color: var(--accent-gold);
}

.stat-item-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.hero-image-container {
  position: absolute;
  right: -50px;
  top: -50px;
  width: 600px;
  height: 600px;
  z-index: 1;
  pointer-events: none;
}

.hero-image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  mask-image: linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%);
}

.main-grid {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: var(--space-xl);
  padding-bottom: var(--space-3xl);
}

.sidebar-menu {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.sidebar-title {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--space-sm);
  padding-left: var(--space-sm);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

.sidebar-item:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: rgba(255, 179, 0, 0.1);
  color: var(--accent-gold);
  border-color: var(--border-gold);
}

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
}

.content-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md);
}

.new-tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all var(--transition-normal);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
}

.new-tool-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-gradient);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.new-tool-card:hover {
  border-color: var(--border-gold);
  background: var(--bg-card-hover);
  transform: translateY(-4px);
  box-shadow: var(--shadow-gold);
}

.new-tool-card:hover::before { opacity: 1; }

.new-tool-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-xl);
}

.new-tool-icon {
  font-size: 32px;
}

.new-tool-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  text-transform: uppercase;
}
.badge-green { background: rgba(39, 174, 96, 0.1); color: var(--accent-green); border: 1px solid rgba(39, 174, 96, 0.2); }
.badge-purple { background: rgba(155, 89, 182, 0.1); color: var(--accent-purple); border: 1px solid rgba(155, 89, 182, 0.2); }

.new-tool-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.new-tool-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-lg);
  flex: 1;
}

.new-tool-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-sm);
}

.right-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.activity-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-md);
}

.activity-item {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
}

.activity-icon {
  background: var(--bg-input);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 1px solid var(--border-color);
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: 13px;
  font-weight: 600;
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
  margin-top: var(--space-lg);
  background: rgba(39, 174, 96, 0.05);
  border: 1px solid rgba(39, 174, 96, 0.2);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-dot {
  width: 10px;
  height: 10px;
  background: var(--accent-green);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--accent-green);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(39, 174, 96, 0); }
  100% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0); }
}

.status-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.status-text span {
  color: var(--text-primary);
}

.community-banner {
  background: linear-gradient(90deg, rgba(255,179,0,0.1) 0%, rgba(0,0,0,0) 100%);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-xl);
}

.community-banner-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.banner-trophy {
  font-size: 32px;
}

.banner-content h3 {
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
}

.banner-content p {
  font-size: 12px;
  color: var(--text-secondary);
}

.banner-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.members-avatars {
  display: flex;
}
.members-avatars img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--bg-primary);
  margin-left: -8px;
}
.members-avatars img:first-child { margin-left: 0; }

.members-count {
  font-size: 12px;
  font-weight: 700;
}
.members-count span {
  display: block;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-tertiary);
}

/* Service Pricing Cards */
.pricing-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all var(--transition-normal);
}
.pricing-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-4px);
  box-shadow: var(--shadow-gold);
}
.pricing-card.popular {
  border-color: var(--border-gold);
  background: linear-gradient(180deg, rgba(255,179,0,0.05) 0%, rgba(26,26,26,1) 100%);
}
.pricing-card.popular::before {
  content: 'MÁS VENDIDO';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent-gradient);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.pricing-header h3 { font-size: 18px; margin-bottom: 4px; }
.pricing-price { font-size: 32px; font-weight: 800; color: var(--accent-gold); margin-bottom: var(--space-md); }
.pricing-features { flex: 1; list-style: none; margin-bottom: var(--space-xl); }
.pricing-features li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.pricing-features li svg { color: var(--accent-gold); width: 14px; height: 14px; }

/* Responsive Grid */
@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
  .hero-new {
    flex-direction: column;
  }
  .hero-image-container {
    position: relative;
    right: 0;
    top: 0;
    width: 100%;
    height: 300px;
  }
}

/* Header Premium Nav */
.header-nav {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
}
.nav-item {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast);
}
.nav-item:hover, .nav-item.active {
  color: var(--text-primary);
}

/* Toast */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}
.toast {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-lg);
  color: white;
  font-size: 13px;
}
.toast-icon { color: var(--accent-gold); }
`;

if(!css.includes('NEW DESIGN SYSTEM CLASSES')) {
  fs.writeFileSync('src/app/globals.css', css + '\n' + additionalStyles);
  console.log('Styles appended successfully.');
} else {
  console.log('Styles already exist.');
}
