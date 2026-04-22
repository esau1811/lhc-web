/**
 * GTA V Weapon Database
 * Maps technical .ytd/.ydr filenames to friendly weapon names, organized by category.
 */

export const WEAPON_CATEGORIES = {
  pistols: {
    label: 'Pistols',
    weapons: [
      { id: 'w_pi_pistol', name: 'Pistol' },
      { id: 'w_pi_combatpistol', name: 'Combat Pistol' },
      { id: 'w_pi_combatpistol_mk2', name: 'Combat Pistol MK2' },
      { id: 'w_pi_pistolmk2', name: 'Pistol MK2' },
      { id: 'w_pi_snspistol', name: 'SNS Pistol' },
      { id: 'w_pi_snspistolmk2', name: 'SNS Pistol MK2' },
      { id: 'w_pi_heavypistol', name: 'Heavy Pistol' },
      { id: 'w_pi_vintage_pistol', name: 'Vintage Pistol' },
      { id: 'w_pi_appistol', name: 'AP Pistol' },
      { id: 'w_pi_stungun', name: 'Stun Gun' },
      { id: 'w_pi_flaregun', name: 'Flare Gun' },
      { id: 'w_pi_doubleaction', name: 'Double Action Revolver' },
      { id: 'w_pi_revolver', name: 'Heavy Revolver' },
      { id: 'w_pi_revolvermk2', name: 'Heavy Revolver MK2' },
      { id: 'w_pi_ceramicpistol', name: 'Ceramic Pistol' },
      { id: 'w_pi_navyrevolver', name: 'Navy Revolver' },
      { id: 'w_pi_gadgetpistol', name: 'Perico Pistol' },
      { id: 'w_pi_pistol50', name: 'Pistol .50' },
    ],
  },
  smgs: {
    label: 'SMGs',
    weapons: [
      { id: 'w_sb_smg', name: 'SMG' },
      { id: 'w_sb_smgmk2', name: 'SMG MK2' },
      { id: 'w_sb_microsmg', name: 'Micro SMG' },
      { id: 'w_sb_minismg', name: 'Mini SMG' },
      { id: 'w_sb_combatpdw', name: 'Combat PDW' },
      { id: 'w_sb_assaultsmg', name: 'Assault SMG' },
      { id: 'w_sb_gusenberg', name: 'Gusenberg Sweeper' },
      { id: 'w_sb_machinepistol', name: 'Machine Pistol' },
    ],
  },
  rifles: {
    label: 'Rifles',
    weapons: [
      { id: 'w_ar_assaultrifle', name: 'Assault Rifle' },
      { id: 'w_ar_assaultriflemk2', name: 'Assault Rifle MK2' },
      { id: 'w_ar_carbinerifle', name: 'Carbine Rifle' },
      { id: 'w_ar_carbineriflemk2', name: 'Carbine Rifle MK2' },
      { id: 'w_ar_advancedrifle', name: 'Advanced Rifle' },
      { id: 'w_ar_specialcarbine', name: 'Special Carbine' },
      { id: 'w_ar_specialcarbinemk2', name: 'Special Carbine MK2' },
      { id: 'w_ar_bullpuprifle', name: 'Bullpup Rifle' },
      { id: 'w_ar_bullpupriflemk2', name: 'Bullpup Rifle MK2' },
      { id: 'w_ar_compactrifle', name: 'Compact Rifle' },
      { id: 'w_ar_militaryrifle', name: 'Military Rifle' },
      { id: 'w_ar_heavyrifle', name: 'Heavy Rifle' },
      { id: 'w_ar_tacticalrifle', name: 'Service Carbine' },
    ],
  },
  shotguns: {
    label: 'Shotguns',
    weapons: [
      { id: 'w_sg_pumpshotgun', name: 'Pump Shotgun' },
      { id: 'w_sg_pumpshotgunmk2', name: 'Pump Shotgun MK2' },
      { id: 'w_sg_sawnoff', name: 'Sawed-Off Shotgun' },
      { id: 'w_sg_assaultshotgun', name: 'Assault Shotgun' },
      { id: 'w_sg_bullpupshotgun', name: 'Bullpup Shotgun' },
      { id: 'w_sg_heavyshotgun', name: 'Heavy Shotgun' },
      { id: 'w_sg_dbshotgun', name: 'Double Barrel Shotgun' },
      { id: 'w_sg_sweeper', name: 'Sweeper Shotgun' },
      { id: 'w_sg_combatshotgun', name: 'Combat Shotgun' },
    ],
  },
  lmgs: {
    label: 'LMGs',
    weapons: [
      { id: 'w_mg_mg', name: 'MG' },
      { id: 'w_mg_combatmg', name: 'Combat MG' },
      { id: 'w_mg_combatmgmk2', name: 'Combat MG MK2' },
      { id: 'w_mg_gusenberg', name: 'Gusenberg Sweeper' },
    ],
  },
  snipers: {
    label: 'Snipers',
    weapons: [
      { id: 'w_sr_sniperrifle', name: 'Sniper Rifle' },
      { id: 'w_sr_heavysniper', name: 'Heavy Sniper' },
      { id: 'w_sr_heavysnipermk2', name: 'Heavy Sniper MK2' },
      { id: 'w_sr_marksmanrifle', name: 'Marksman Rifle' },
      { id: 'w_sr_marksmanriflemk2', name: 'Marksman Rifle MK2' },
    ],
  },
  heavy: {
    label: 'Heavy',
    weapons: [
      { id: 'w_lr_rpg', name: 'RPG' },
      { id: 'w_lr_grenadelauncher', name: 'Grenade Launcher' },
      { id: 'w_lr_minigun', name: 'Minigun' },
      { id: 'w_lr_homing', name: 'Homing Launcher' },
      { id: 'w_lr_compactgl', name: 'Compact Grenade Launcher' },
      { id: 'w_lr_railgun', name: 'Railgun' },
    ],
  },
  melee: {
    label: 'Melee',
    weapons: [
      { id: 'w_me_knife', name: 'Knife' },
      { id: 'w_me_bat', name: 'Baseball Bat' },
      { id: 'w_me_crowbar', name: 'Crowbar' },
      { id: 'w_me_golfclub', name: 'Golf Club' },
      { id: 'w_me_hammer', name: 'Hammer' },
      { id: 'w_me_hatchet', name: 'Hatchet' },
      { id: 'w_me_machete', name: 'Machete' },
      { id: 'w_me_switchblade', name: 'Switchblade' },
      { id: 'w_me_nightstick', name: 'Nightstick' },
      { id: 'w_me_wrench', name: 'Wrench' },
      { id: 'w_me_battleaxe', name: 'Battle Axe' },
      { id: 'w_me_poolcue', name: 'Pool Cue' },
      { id: 'w_me_stone_hatchet', name: 'Stone Hatchet' },
      { id: 'w_me_dagger', name: 'Antique Cavalry Dagger' },
    ],
  },
  throwables: {
    label: 'Throwables',
    weapons: [
      { id: 'w_ex_grenade', name: 'Grenade' },
      { id: 'w_ex_molotov', name: 'Molotov' },
      { id: 'w_ex_stickybomb', name: 'Sticky Bomb' },
      { id: 'w_ex_proxmine', name: 'Proximity Mine' },
      { id: 'w_ex_pipebomb', name: 'Pipe Bomb' },
      { id: 'w_ex_smokegrenadelauncher', name: 'Smoke Grenade' },
      { id: 'w_ex_flashbang', name: 'Flashbang' },
    ],
  },
};

/** Flat map: technical_id -> friendly name */
export const WEAPON_MAP = {};
Object.values(WEAPON_CATEGORIES).forEach((cat) => {
  cat.weapons.forEach((w) => {
    WEAPON_MAP[w.id.toLowerCase()] = w.name;
  });
});

/**
 * Get all weapons as a flat array with category info
 */
export function getAllWeapons() {
  const result = [];
  Object.entries(WEAPON_CATEGORIES).forEach(([catId, cat]) => {
    cat.weapons.forEach((w) => {
      result.push({ ...w, category: catId, categoryLabel: cat.label });
    });
  });
  return result;
}

/**
 * Detect weapon from a list of filenames found inside an RPF
 */
export function detectWeaponFromFilenames(filenames) {
  const lowerNames = filenames.map((f) => f.toLowerCase());

  for (const [techId, friendlyName] of Object.entries(WEAPON_MAP)) {
    for (const fname of lowerNames) {
      // Check if filename contains weapon technical ID
      if (fname.includes(techId)) {
        return { id: techId, name: friendlyName };
      }
    }
  }

  // Try partial matching with common patterns
  for (const fname of lowerNames) {
    for (const [techId, friendlyName] of Object.entries(WEAPON_MAP)) {
      const shortId = techId.replace('w_', '').replace('pi_', '').replace('sb_', '')
        .replace('ar_', '').replace('sg_', '').replace('mg_', '')
        .replace('sr_', '').replace('lr_', '').replace('me_', '')
        .replace('ex_', '');
      if (fname.includes(shortId) && shortId.length > 3) {
        return { id: techId, name: friendlyName };
      }
    }
  }

  return null;
}
