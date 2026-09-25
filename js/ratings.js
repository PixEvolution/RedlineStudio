// ratings.js — content ratings and the age gate, as pure logic.
//
// Every game carries a rating its maker picks (the casino is always 18+).
// Players declare a birth date ONCE in Account settings; only the resulting
// AGE BRACKET is ever stored ("u13" / "13" / "16" / "18") — never the date,
// never a real identity. Adult content additionally requires a VERIFIED
// EMAIL, so "18+" means declared adult AND a reachable, confirmed inbox.
//
// Someone with NO declared age (guests, old accounts) can play E and Teen
// content — the platform is for everyone — but 16+ and 18+ stay shut until
// they declare. Honest self-declaration is the industry-standard bar for a
// free platform with no payments and no identity collection.

export const RATINGS = [
  { id: "E",   badge: "E",   label: "E — Everyone",            min: 0,  needsEmail: false },
  { id: "T13", badge: "13+", label: "T — Teen (13+)",          min: 13, needsEmail: false },
  { id: "M16", badge: "16+", label: "M — Mature (16+)",        min: 16, needsEmail: false },
  { id: "A18", badge: "18+", label: "A — Adult (18+, verified)", min: 18, needsEmail: true }
];

export function cleanRating(r) {
  return RATINGS.some(x => x.id === r) ? r : "E";
}

export function ratingInfo(r) {
  return RATINGS.find(x => x.id === cleanRating(r));
}

// birth date string ("YYYY-MM-DD") → age bracket, or null when it isn't a
// believable date. The date itself is never kept.
export function bracketFromBirthdate(dob, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || "").trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = now.getFullYear() - y;
  const hadBirthday = (now.getMonth() + 1 > mo) || (now.getMonth() + 1 === mo && now.getDate() >= d);
  if (!hadBirthday) age--;
  if (age < 0 || age > 120) return null;
  if (age >= 18) return "18";
  if (age >= 16) return "16";
  if (age >= 13) return "13";
  return "u13";
}

export function bracketAge(bracket) {
  if (bracket === "18") return 18;
  if (bracket === "16") return 16;
  if (bracket === "13") return 13;
  if (bracket === "u13") return 0;
  return null;   // never declared
}

// The gate. bracket: from the player's users doc (null = never declared).
// emailVerified: the player's own auth state. Returns { ok, why }:
//   why "age"     → too young (or undeclared, for 16+/18+)
//   why "declare" → undeclared age where 16+/18+ needs one
//   why "verify"  → old enough, but adult content needs a verified email
export function canPlay(rating, bracket, emailVerified) {
  const info = ratingInfo(rating);
  const age = bracketAge(bracket);
  if (info.min >= 16 && age === null) return { ok: false, why: "declare" };
  if (age !== null && age < info.min) return { ok: false, why: "age" };
  if (info.needsEmail && !emailVerified) return { ok: false, why: "verify" };
  return { ok: true, why: null };
}

// Linking an email is 13+ (younger accounts stay contact-free — by design).
export function canLinkEmail(bracket) {
  const age = bracketAge(bracket);
  return age !== null && age >= 13;
}
