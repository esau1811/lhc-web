const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');

const missingStyles = `
/* HEADER NAV FIX */
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

/* PRICING CARDS FIX (PREMIUM PAGE) */
.pricing-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all var(--transition-normal);
}

.pricing-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
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
  font-size: 11px;
  font-weight: 800;
  padding: 4px 14px;
  border-radius: var(--radius-full);
}

.pricing-header {
  margin-bottom: var(--space-xl);
}

.pricing-header h3 { 
  font-size: 18px; 
  margin-bottom: 8px; 
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pricing-price { 
  font-size: 42px; 
  font-weight: 800; 
  color: var(--accent-gold); 
}

.pricing-features { 
  flex: 1; 
  list-style: none; 
  margin-bottom: var(--space-2xl); 
  padding-left: 0;
}

.pricing-features li { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  font-size: 14px; 
  color: var(--text-secondary); 
  margin-bottom: 12px; 
}

.pricing-features li svg { 
  color: var(--accent-gold); 
  min-width: 16px;
}

/* HERO FIXES */
.hero-content-wrapper {
  padding: var(--space-2xl) 0;
}

.hero-right-col {
  margin-right: 0;
}

/* CARDS GRID FIX */
.cards-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

/* FIX LAYOUT WIDTH */
.main-grid {
  grid-template-columns: 240px 1fr 300px;
}
`;

if (!css.includes('.header-nav {')) {
  fs.writeFileSync('src/app/globals.css', css + '\n' + missingStyles);
  console.log('Missing styles added.');
} else {
  console.log('Styles already present.');
}
