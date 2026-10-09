// courses.js — the course system: the roadmap (one course per museum machine,
// in historical order), and per-ACCOUNT progress in Firestore (/progress/{uid},
// readable like a trophy shelf, writable only by its owner).
//
// A course runs INSIDE its own Studio: studio.html?course=<id> opens the same
// editor on a separate draft (your normal work is untouched) with the lesson
// docked as a panel. The lesson watches the real workspace, so steps tick
// themselves when the work is actually done — completing a course is earned,
// and completing one unlocks the next on the account.

// Firebase loads lazily inside the progress functions, so the roadmap half of
// this module stays pure — importable by the hub, the Studio, and the tests.
const fb = async () => {
  const [{ db }, { auth, authReady }, fs] = await Promise.all([
    import("./firebase.js"),
    import("./auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
  ]);
  return { db, auth, authReady, ...fs };
};

// The roadmap: museum order, 1947 → the Casino. `ready` marks written courses.
export const COURSES = [
  { id: "crt", title: "CRT Amusement Device", year: "1947", ready: true,
    teaches: "objects, properties, events, your first whole game" },
  { id: "bertie", title: "Bertie the Brain", year: "1950" },
  { id: "nimrod", title: "NIMROD", year: "1951" },
  { id: "checkers", title: "Draughts", year: "1951" },
  { id: "oxo", title: "OXO", year: "1952" },
  { id: "tennis", title: "Tennis for Two", year: "1958" },
  { id: "mouse", title: "Mouse in the Maze", year: "1959" },
  { id: "txo", title: "Tic-Tac-Toe on TX-0", year: "1959" },
  { id: "spacewar", title: "Spacewar!", year: "1962" },
  { id: "galaxy", title: "Computer Space", year: "1971" },
  { id: "odyssey", title: "Odyssey Table Tennis", year: "1972" },
  { id: "pong", title: "Pong", year: "1972" },
  { id: "spacerace", title: "Space Race", year: "1973" },
  { id: "gotcha", title: "Gotcha", year: "1973" },
  { id: "wumpus2", title: "Hunt the Wumpus (Teletype)", year: "1973" },
  { id: "wumpus", title: "Hunt the Wumpus (Map)", year: "1973" },
  { id: "grantrak", title: "Gran Trak 10", year: "1974" },
  { id: "tank", title: "Tank", year: "1974" },
  { id: "mazewar", title: "Maze War", year: "1974" },
  { id: "mazewar2", title: "Maze War Arena", year: "1974" },
  { id: "spasim", title: "Spasim", year: "1974" },
  { id: "westerngun", title: "Western Gun", year: "1975" },
  { id: "gunfight", title: "Gun Fight", year: "1975" },
  { id: "sharkjaws", title: "Shark", year: "1975" },
  { id: "breakout", title: "Breakout", year: "1976" },
  { id: "deathrace", title: "Death Race", year: "1976" },
  { id: "echocave", title: "Echo Cave", year: "1976" },
  { id: "nightdriver", title: "Night Driver", year: "1976" },
  { id: "combat", title: "Combat", year: "1977" },
  { id: "undervault", title: "Undervault", year: "1977" },
  { id: "invaders", title: "Space Invaders", year: "1978" },
  { id: "galaxian", title: "Galaxian", year: "1979" },
  { id: "lunarlander", title: "Lunar Lander", year: "1979" },
  { id: "asteroids", title: "Asteroids", year: "1979" },
  { id: "adventure2600", title: "Adventure", year: "1979" },
  { id: "starraiders", title: "Star Raiders", year: "1979" },
  { id: "rallyx", title: "Rally-X", year: "1980" },
  { id: "sweeper", title: "Sweeper", year: "1980" },
  { id: "missilecommand", title: "Missile Command", year: "1980" },
  { id: "battlezone", title: "Battlezone", year: "1980" },
  { id: "berzerk", title: "Berzerk", year: "1980" },
  { id: "rogue", title: "Rogue", year: "1980" },
  { id: "defender", title: "Defender", year: "1980" },
  { id: "emberhall", title: "Emberhall", year: "1980" },
  { id: "scrapyard", title: "Scrapyard Climb", year: "1981" },
  { id: "galaga", title: "Galaga", year: "1981" },
  { id: "frogger", title: "Frogger", year: "1981" },
  { id: "sweeper2", title: "Sweeper II", year: "1981" },
  { id: "wolfenstein", title: "Castle Wolfenstein", year: "1981" },
  { id: "ultima", title: "Ultima I", year: "1981" },
  { id: "pitfall", title: "Pitfall!", year: "1982" },
  { id: "digdug", title: "Dig Dug", year: "1982" },
  { id: "robotron", title: "Robotron: 2084", year: "1982" },
  { id: "cubit", title: "Cubit", year: "1982" },
  { id: "poleposition", title: "Pole Position", year: "1982" },
  { id: "zaxxon", title: "Zaxxon", year: "1982" },
  { id: "tron", title: "Tron", year: "1982" },
  { id: "slots", title: "Redline Slots", year: "casino" }
];

export const courseIndex = (id) => COURSES.findIndex(c => c.id === id);

// Course n is open when every course before it is done (course 1 is always open).
export function isUnlocked(id, progress) {
  const i = courseIndex(id);
  if (i <= 0) return i === 0;
  return COURSES.slice(0, i).every(c => progress && progress[c.id]);
}

// ---- per-account progress: /progress/{uid} → { courses: { crt: <ms>, … } }
export async function myProgress() {
  let env;
  try { env = await fb(); } catch { return null; }   // offline / blocked: treat as logged out
  const { db, auth, authReady, doc, getDoc } = env;
  await authReady;
  const u = auth.currentUser;
  if (!u) return null;                     // logged out: no saved progress
  try {
    const s = await getDoc(doc(db, "progress", u.uid));
    return (s.exists() && s.data().courses) || {};
  } catch { return {}; }
}

export async function markDone(courseId) {
  const { db, auth, authReady, doc, setDoc } = await fb();
  await authReady;
  const u = auth.currentUser;
  if (!u) return false;                    // the course still ran — just unsaved
  const cur = (await myProgress()) || {};
  if (cur[courseId]) return true;          // already on the shelf
  await setDoc(doc(db, "progress", u.uid), { courses: { ...cur, [courseId]: Date.now() } });
  return true;
}
