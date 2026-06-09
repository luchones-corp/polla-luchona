const teamIdToFlag: Record<number, string> = {
  778: 'dz',    // Algeria
  762: 'ar',    // Argentina
  779: 'au',    // Australia
  816: 'at',    // Austria
  805: 'be',    // Belgium
  1060: 'ba',   // Bosnia-Herzegovina
  764: 'br',    // Brazil
  828: 'ca',    // Canada
  1930: 'cv',   // Cape Verde
  818: 'co',    // Colombia
  1934: 'cd',   // Congo DR
  799: 'hr',    // Croatia
  9460: 'cw',   // Curaçao
  798: 'cz',    // Czechia
  791: 'ec',    // Ecuador
  825: 'eg',    // Egypt
  770: 'gb-eng',// England
  773: 'fr',    // France
  759: 'de',    // Germany
  763: 'gh',    // Ghana
  836: 'ht',    // Haiti
  840: 'ir',    // Iran
  8062: 'iq',   // Iraq
  1935: 'ci',   // Ivory Coast
  766: 'jp',    // Japan
  8049: 'jo',   // Jordan
  769: 'mx',    // Mexico
  815: 'ma',    // Morocco
  8601: 'nl',   // Netherlands
  783: 'nz',    // New Zealand
  8872: 'no',   // Norway
  1836: 'pa',   // Panama
  761: 'py',    // Paraguay
  765: 'pt',    // Portugal
  8030: 'qa',   // Qatar
  801: 'sa',    // Saudi Arabia
  8873: 'gb-sct',// Scotland
  804: 'sn',    // Senegal
  774: 'za',    // South Africa
  772: 'kr',    // South Korea
  760: 'es',    // Spain
  792: 'se',    // Sweden
  788: 'ch',    // Switzerland
  802: 'tn',    // Tunisia
  803: 'tr',    // Turkey
  771: 'us',    // United States
  758: 'uy',    // Uruguay
  8070: 'uz',   // Uzbekistan
}

export function getFlagUrl(teamId: number | null, width = 160): string | null {
  if (teamId === null) return null
  const code = teamIdToFlag[teamId]
  if (!code) return null
  return `https://flagcdn.com/w${width}/${code}.png`
}
