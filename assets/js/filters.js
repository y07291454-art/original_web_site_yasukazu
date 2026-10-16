/* Small shared helpers. They also work in Node for data and filter checks. */
(function (root) {
  'use strict';
  function normalize(value) {
    return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
      .replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .toLowerCase().replace(/[\s・.\-–—'’#]/g, '');
  }
  function teamMatches(team, query = '', conference = '', division = '') {
    const text = normalize([team.name, team.jp, team.abbreviation, team.home_city, ...(team.aliases || [])].join(' '));
    return (!conference || team.conference === conference) && (!division || team.division === division) && text.includes(normalize(query));
  }
  function playerMatches(player, query = '', position = '') {
    const text = normalize([player.name, player.jp, player.number, ...(player.aliases || [])].join(' '));
    return (!position || player.position.split('-').includes(position)) && text.includes(normalize(query));
  }
  function heightCm(value) {
    const match = /^(\d+)-(\d+)$/.exec(value || '');
    return match ? Math.round((Number(match[1]) * 12 + Number(match[2])) * 2.54) : null;
  }
  function weightKg(value) { return value && Number.isFinite(Number(value)) ? Math.round(Number(value) * 0.45359237 * 10) / 10 : null; }
  const helpers = { normalize, teamMatches, playerMatches, heightCm, weightKg };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  else root.NBA_FILTERS = helpers;
})(typeof window === 'undefined' ? globalThis : window);
