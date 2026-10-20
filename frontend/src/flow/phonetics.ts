// ARPAbet (CMU dictionary) → IPA, used to name a rhyme group by its shared sound.

const IPA: Record<string, string> = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ',
  IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'g', HH: 'h', JH: 'dʒ', K: 'k', L: 'l',
  M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v',
  W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};

/** "AY M" → "/aɪm/". Returns "" when a phone is unknown: the backend falls back to
 *  plain letters for out-of-dictionary words, which would read like a misspelling. */
export function phoneticToIpa(key: string | undefined | null): string {
  if (!key) return '';
  const phones = key.trim().split(/\s+/).map((phone) => phone.replace(/[0-2]$/, '').toUpperCase());
  if (phones.some((phone) => !(phone in IPA))) return '';
  return `/${phones.map((phone) => IPA[phone]).join('')}/`;
}
