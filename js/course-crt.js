// course-crt.js — COURSE 1: the CRT Amusement Device (1947), second edition.
// Rewritten after real playtesting with one rule: NO CLIFFS. The reader has
// never coded, never opened a game editor, maybe never wanted to until today.
// Every idea gets three layers — what it does on the surface, what's really
// happening under the hood, and where to learn more — and the pace never
// jumps from "ok I get this" to "uhhh what".
//
// Checks receive ctx { objects, fresh, testCount, published } and must
// survive both typed code and 🧱 blocks, so they search the script's JSON.
// Steps are LATCHED by the lesson window: once earned, never unticked.

const scriptText = (o) => JSON.stringify(o.script || []);
const byName = (ctx, name) => ctx.objects.find(x => (x.name || "").toLowerCase() === name);
const deeper = (inner) =>
  `<div style="border:1px solid #3a4452; border-radius:8px; padding:8px 12px; margin:10px 0">
     <b>📚 Go deeper (optional):</b> ${inner}</div>`;

export const course = {
  id: "crt",
  title: "Course 1 · CRT Amusement Device (1947)",
  intro: "From absolute zero to your own published machine, on the oldest video game there is.",

  chapters: [

    // ---------------------------------------------------------------- 0
    {
      title: "Welcome",
      html: `
<p><b>You know nothing about making games? Perfect.</b> That's exactly who this course is written for.
Nobody here assumes you can code — because the first video game makers couldn't either. Code didn't exist
yet. They had the same thing you have: an idea and a screen.</p>
<p>Here's the whole secret, the one every game ever made is built on:</p>
<p style="text-align:center"><b>a game = things on a screen + rules for how they act.</b></p>
<p>That's it. Pong is two paddles, a ball, and rules. The biggest game you've ever played is a million
things and a million rules — but it's the same sentence. This course teaches you the sentence.</p>
<p><b>How this works:</b> this little window is the lesson. The <b>🎮 button</b> at the top opens the
course's own full-size Studio — park the two side by side. The course Studio is a separate workspace, so
anything you were building in your normal Studio is safe. When the lesson asks you to do something,
<b>it watches that Studio and ticks the step itself</b> the moment you've really done it — and a step you've
earned <b>stays earned</b>, even if you change things later.</p>
<p><b>This course is long on purpose.</b> It doesn't just show you buttons to press — it explains what each
thing is, what's happening under the hood, and where to learn more when you're curious. Take it in
sittings: the lesson <b>remembers your chapter and your progress</b>, so closing this window costs nothing.
Rather listen than read? The <b>🔊</b> up top reads any chapter aloud.</p>
<p>By the end you will have: read the oldest video game ever patented, understood exactly how it thinks —
really understood, not copy-pasted — and <b>built and published a working machine of your own.</b>
Press <b>Next ▸</b>.</p>`
    },

    // ---------------------------------------------------------------- 1
    {
      title: "1947",
      html: `
<p>Two years after World War II, two television engineers — <b>Thomas Goldsmith</b> and
<b>Estle Ray Mann</b> — filed a patent for something nobody had a word for yet: a game you play
<i>on a screen</i>.</p>
<p>They called it the <b>Cathode-Ray Tube Amusement Device</b>. A cathode-ray tube — a CRT — is the glass
heart of every old TV: an electron beam fires at the glass and makes a glowing dot wherever it lands.
Goldsmith and Mann's idea: let a player <b>steer that dot</b> with knobs, like aiming an artillery shell,
and try to land it on a target.</p>
<p>Three things to know about it, because all three still matter:</p>
<p>① <b>The targets weren't on the screen.</b> The machine could only draw the one glowing dot — so the
targets were printed on <b>plastic sheets taped to the glass</b>. The first video game had paper DLC.</p>
<p>② <b>A hit was an explosion of focus.</b> Land the dot on a target and the beam <i>defocused</i> — the
sharp dot bloomed into a fuzzy blast, like a shell going off. The first special effect.</p>
<p>③ <b>It was never sold.</b> Patented in 1948, demonstrated, and then… nothing. The world wasn't ready,
parts were expensive, and the two engineers went back to building televisions. Video games then waited
<b>ten more years</b> for the next attempt.</p>
<p>So the oldest video game is a ghost: it exists as a patent diagram and a handful of prototypes. Which is
why the museum rebuilt it — and why you're about to.</p>
${deeper(`the patent is real and readable — search <b>US patent 2,455,992</b>, or read the
<a href="https://en.wikipedia.org/wiki/Cathode-ray_tube_amusement_device" target="_blank" rel="noopener"
style="color:#ff8f8c">Wikipedia article on the Cathode-Ray Tube Amusement Device</a>. The museum's own
<a href="museum.html" target="_blank" style="color:#ff8f8c">Museum page</a> tells the whole 1947–1982 story.`)}`
    },

    // ---------------------------------------------------------------- 2
    {
      title: "A machine with no computer",
      html: `
<p>Here's the part that breaks people's brains: the 1947 machine had <b>no computer</b>. No chip, no
memory, no program. Computers existed — barely — but they filled rooms and belonged to armies.</p>
<p>So how did it work? <b>The circuits were the rules.</b></p>
<p>The knobs charged capacitors; the capacitors bent the electron beam; the beam's arc across the screen
WAS the "physics." Nothing calculated the missile's path — the path was just what electricity does when you
wire it that way. If you wanted different rules, you didn't edit a file. You got out a soldering iron.</p>
<p>Keep that picture, because it explains the next thirty years of this museum: every machine until 1975 —
Pong included! — works this way: <b>wired logic</b>, rules made of copper. The reason old games feel so pure
is that every rule had to be built by hand out of parts.</p>
<p>And it explains why what YOU have is a superpower. In the Studio, a rule is a sentence:
<span class="code">change self.y by 5</span> — "move this thing down the screen a little." Goldsmith needed
a capacitor, a vacuum tube and an afternoon; you need nine keystrokes. Same rule. Your soldering iron is a
keyboard.</p>
<p>Before we read their machine, let's get you comfortable in the workshop — press <b>Next ▸</b>.</p>`
    },

    // ---------------------------------------------------------------- 3
    {
      title: "Meet the Studio",
      html: `
<p>Hit the <b>🎮 button</b> up top if you haven't — this chapter is a guided look around that window, so
nothing in it ever surprises you again. Don't touch anything yet. Just find each piece:</p>
<p><b>The toolbar</b> (top row): <b>▶ Test</b> plays whatever you've built, right there. <b>💾 Save</b>
publishes. <b>↶ ↷</b> are undo and redo. The <b>🎓</b> button replays a guided tour anytime. Everything
else can wait.</p>
<p><b>The Explorer</b> (the list): every <i>thing</i> in your game, by name — the "things on a screen" half
of our sentence. The buttons above it (+ Dot, + Ring, + Text…) add new things. Click a name and that thing
is <b>selected</b>: the other panels now talk about IT.</p>
<p><b>The workspace</b> (the black screen): your game's world. Drag things around it with the mouse. The
size buttons under it (S · M · L · MAX) make it bigger on YOUR monitor — use them! A bigger screen makes
everything in this course easier.</p>
<p><b>Properties:</b> the selected thing's facts — where it is (x, y), how big (size), what color. Change a
number, watch the thing obey. This is the "what it is" panel.</p>
<p><b>The Script panel:</b> the "how it acts" panel — the rules half of our sentence, and the only panel
that looks scary. Here's the whole trick to reading it: <b>a script is a stack of cards.</b> Each card
starts with a <b>when</b> — <i>when the game starts, when a key is pressed, when the clock ticks</i> — and
inside the card is a to-do list of what happens then. That's all a script is: <b>when THIS happens, do
THAT.</b> Like a doorbell: <i>when pressed → make noise.</i></p>
<p>Some cards in the museum machines are <b>📜 Code</b> cards — the same when/do language, typed as text
instead of built from blocks. Important: <b>it is not a different, harder thing.</b> The Script panel's
<b>🧱 To blocks</b> button turns any typed code into blocks, and <b>📜 To code</b> turns blocks back into
text. Same program, two outfits. You'll use both today and you get to keep whichever you like.</p>
<p><b>You cannot break anything.</b> Undo holds your last 60 moves, the Studio autosaves constantly, and
this course Studio is a sandbox. The worst case in this entire course is "huh, weird" followed by ↶.</p>
${deeper(`every panel in the Studio has a little <b>ⓘ</b> that opens its section of the
<a href="guide.html" target="_blank" style="color:#ff8f8c">Coding Guide</a> — the guide starts at zero and
goes all the way to online 3D, and it's the reference this course leans on.`)}`
    },

    // ---------------------------------------------------------------- 4
    {
      title: "Open it up and PLAY with it",
      html: `
<p>Time to touch history. No reading code yet — this chapter is hands-on: load the machine, play it, then
reach in and change it. Every step ticks itself when the lesson sees you've done it.</p>`,
      steps: [
        {
          text: `<b>Load the machine.</b>
          <button class="btn btn-small" data-act="load-example">⬇ Load the museum's CRT machine</button>
          — it appears in the Studio's workspace, and the Explorer fills with its six things:
          <span class="code">missile</span> (the glowing beam spot), <span class="code">target1-3</span>
          (the "plastic overlay" targets), <span class="code">hud</span> (the readout), and
          <span class="code">aimline</span> (a tiny aim marker).`,
          check: (ctx) => !!(byName(ctx, "missile") && byName(ctx, "target1"))
        },
        {
          text: `<b>Play it.</b> Hit <b>▶ Test</b> in the Studio. Up/Down aims, SPACE fires — gravity bends
          every shot, exactly like the 1947 arc. Destroy all three targets at least once, get a feel for how
          the aim number changes your arc. Then press <b>▶ Test</b> again (or ✕) to stop.`,
          check: (ctx) => ctx.testCount >= 1
        },
        {
          text: `<b>Change what it IS.</b> Click <span class="code">missile</span> in the Explorer, find
          <b>color</b> in Properties, and pick any color you like (there's a real color picker next to the
          text box). The beam spot has been green since 1947 — it's yours now. <span class="hint">What you
          just used is a <b>property</b>: a fact about a thing. x, y, size, color — change the fact, the
          thing obeys. No code involved.</span>`,
          check: (ctx) => {
            const m = byName(ctx, "missile");
            return !!(m && String(m.color || "").toLowerCase() !== "#39ff5e");
          }
        },
        {
          text: `<b>Change it some more.</b> Still on <span class="code">missile</span>: set its
          <b>size</b> to <b>14</b> or bigger and Test again — a fat, proud beam spot. <span class="hint">
          Notice what just happened: you modified a 1947 arcade machine twice, and it took seconds. THIS
          is the whole feeling of game making — change a thing, press Test, see what happens. Everything
          past this point is just more of that loop.</span>`,
          check: (ctx) => {
            const m = byName(ctx, "missile");
            return !!(m && Number(m.size) >= 12);
          }
        }
      ]
    },

    // ---------------------------------------------------------------- 5
    {
      title: "Reading the brain, part 1",
      html: `
<p>Now the good stuff. Click <span class="code">missile</span> in the Explorer and look at its Script
panel — the stack of when-cards that IS this machine's brain. We'll read it one card at a time, slowly.
Nothing here needs memorizing: the point is that by the end of this chapter, none of it is mysterious.</p>

<p><b>Card 1 — when the game starts.</b> The first card says <i>when game starts</i>, and its to-do list
is mostly lines like:</p>
<pre class="codeblock">set aim to -5
set hits to 0
set flying to 0</pre>
<p><b>Surface:</b> when the game begins, write down three numbers: aim is -5, hits is 0, flying is 0.</p>
<p><b>Under the hood:</b> <span class="code">aim</span>, <span class="code">hits</span> and
<span class="code">flying</span> are <b>variables</b> — and a variable is just <b>a box with a name and a
number inside</b>. The game remembers the box; any rule can look in it or change it. "set aim to -5" means
<i>put -5 in the box called aim</i>. That's genuinely all a variable is — the single most important idea in
all of programming, and it's a labeled box.</p>
<p>Why -5? Because aim is going to be the shot's up/down speed, and in screen-world, <b>negative means up</b>
(y counts down from the top of the screen — a TV habit from before games existed). File that away; it
explains half of all game code you'll ever read.</p>

<p><b>Cards 2 and 3 — when a key is pressed.</b></p>
<pre class="codeblock">when key ArrowUp
  if flying == 0 then
    change aim by -0.5
  end</pre>
<p><b>Surface:</b> when Up is pressed — IF no shot is flying right now — make aim a little more negative
(aim higher). The ArrowDown card is its mirror.</p>
<p><b>Under the hood, two new words:</b> <span class="code">change aim by -0.5</span> means <i>take what's
in the box and add -0.5 to it</i> (set replaces, change adjusts). And the
<span class="code">if … then … end</span> around it is a <b>condition</b> — a rule with a bouncer at the
door. The lines inside only run when the test is true. Here the bouncer checks "is the box called flying
holding 0?" — because re-aiming a shell that's already in the air would be cheating. One equals sign
<span class="code">=</span> never appears in a test, by the way: <b>comparing is ==</b> (two), because
"set" already took the single one.</p>

<p><b>Card 4 — when SPACE is pressed.</b></p>
<pre class="codeblock">when key Space
  if flying == 0 then
    set flying to 1
    set vy to aim
  end</pre>
<p><b>Surface:</b> fire! But look closely — <b>nothing moves here.</b> Firing just writes numbers in boxes:
flying becomes 1, and vy (the shot's vertical speed) gets a copy of your aim.</p>
<p>That feels wrong the first time you see it. Where's the launch?? Hold that thought — the launch lives in
the next card, and the answer is the deepest idea in this whole course.</p>`
    },

    // ---------------------------------------------------------------- 6
    {
      title: "Reading the brain, part 2",
      html: `
<p><b>The last card — when tick — is the machine's heartbeat.</b> Everything you've ever seen move on a
screen moves because of a card like this one.</p>
<p><b>Surface:</b> <i>when tick</i> runs its to-do list <b>60 times every second</b>, forever. Not when you
press something — always. It's the card where the game is <i>alive</i>.</p>
<p><b>Under the hood:</b> nothing on a screen really "moves." Things get redrawn in a slightly different
place, 60 times a second, and your eye does the rest — a flipbook. So "make the shot fly" is really "every
tick, nudge the shot's position a little." Here's the museum machine's flight, straight from the card:</p>
<pre class="codeblock">if flying == 1 then
  change self.x by 4
  change self.y by vy
  set vy to vy + 0.12
end</pre>
<p>Read it as a flipbook page, 60 of these a second: IF a shot is in the air — slide it 4 to the right,
slide it by vy vertically… <b>and then make vy itself a little bigger.</b></p>
<p>That last line is the one to stare at. vy starts negative (your aim — negative is up, remember). Every
tick adds +0.12, so vy creeps from "going up" toward "going down." The shot rises, slows, tips over,
falls. <b>That one line is gravity.</b> Goldsmith built it from a capacitor; here it's seven words. The
grown-up word for vy is <b>velocity</b>, and position-changed-by-velocity-changed-by-gravity is the actual
physics every game from Pong to the newest blockbuster runs on. You now know it.</p>
<p><b>The hit.</b> Next in the card:</p>
<pre class="codeblock">if target1.visible == 1 and dist(self, target1) < 22 then
  explode target1
  set target1.visible to 0
  set hits to hits + 1
  set flying to 2
end</pre>
<p><b>Surface:</b> if target 1 is still standing AND the shot is close to it — blow it up, hide it, count
it, and mark the shot as finished.</p>
<p><b>Under the hood:</b> <span class="code">dist(self, target1)</span> measures the straight-line gap
between two things, center to center (<span class="code">self</span> always means "the thing this script
belongs to" — here, the missile). So "a hit" is literally <i>the gap is smaller than 22</i> — an invisible
circle around the target. Make the 22 bigger, hits get generous; smaller, they get strict. Every hitbox in
every game is some version of this. And <span class="code">explode</span>? That's Goldsmith's defocused
beam, kept as a one-word tribute.</p>
<p><b>The mood ring.</b> You've now seen <span class="code">flying</span> be 0, 1 and 2: 0 = on the pad
(keys aim), 1 = in the air (physics runs), 2 = "that one's done — reset me," and the card's last section
turns 2 back into 0 with the shot back at the start. One box, three moods, and each rule checks the mood
before acting. <b>This pattern runs the entire museum</b> — games are made of moods.</p>
${deeper(`the grown-up name for the mood pattern is a <b>state machine</b>, and velocity/gravity live in
any intro to <b>game physics</b> — the
<a href="guide.html#recipes" target="_blank" style="color:#ff8f8c">guide's Recipes section</a> has both in
working form. For programming-from-zero outside this site, Khan Academy's free
<a href="https://www.khanacademy.org/computing/computer-programming" target="_blank" rel="noopener"
style="color:#ff8f8c">Computer Programming course</a> is the gentlest trusted start.`)}
<p><b>Prove you own it:</b> in the Studio, find <span class="code">change self.x by 4</span> in that card,
make the 4 an 8, and Test. Twice the muzzle velocity, and you knew exactly why before you pressed Test.
<i>That's the difference between copying code and reading it.</i> Undo (↶) puts it back.</p>`
    },

    // ---------------------------------------------------------------- 7
    {
      title: "Build your own — the things",
      html: `
<p>Now you build. Your machine, not a copy: the museum's shot flies <i>sideways</i> with gravity — yours
will launch <b>straight up</b>, steerable on the pad, with a target that <b>comes back for more</b> and the
one thing Goldsmith never got: <b>a public high-score table.</b></p>
<p>This chapter places the <i>things</i>; the next one writes the <i>rules</i>. (Our sentence again.)
Every step ticks itself — and steps you've already earned stay earned, so don't worry about the chapter-4
ticks when the workspace clears.</p>`,
      steps: [
        {
          text: `<b>Start fresh.</b> <button class="btn btn-small" data-act="start-fresh">🧹 Clear the workspace</button>
          — the museum machine's job is done. (It reloads any time from chapter 5 if you want to peek back.)`,
          check: (ctx) => ctx.fresh
        },
        {
          text: `<b>Put your game's name on screen.</b> Explorer → <b>+ Text</b>. In Properties: set
          <b>name</b> to <span class="code">title</span>, type your game's name into <b>text</b> (anything —
          it's YOUR machine), and drag it near the top. <span class="hint">Why name things? Because rules
          talk to things by name. "title" is for you; the next object's name is for the SCRIPT, so it has
          to be exact.</span>`,
          check: (ctx) => {
            const t = byName(ctx, "title");
            return !!(t && t.type === "text" && String(t.text || "").trim().length > 0 && t.y < 140);
          }
        },
        {
          text: `<b>Add the target.</b> <b>+ Ring</b>, name it exactly <span class="code">target1</span>,
          drag it into the top half of the screen. <span class="hint">Exactly target1, because your script
          is about to say "dist(self, target1)" — a name that doesn't match is a friend the script can't
          find.</span>`,
          check: (ctx) => {
            const t = byName(ctx, "target1");
            return !!(t && t.type === "ring" && t.y < 190);
          }
        },
        {
          text: `<b>Add the cannon.</b> <b>+ Dot</b>, name it <span class="code">cannon</span>, and type
          its position straight into Properties: <b>x 240, y 320</b> — bottom middle.
          <span class="hint">Typing exact numbers instead of dragging is a habit worth starting now: it's
          how you line things up on purpose.</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            return !!(c && c.type === "dot" && c.y > 260 && c.x > 140 && c.x < 340);
          }
        }
      ]
    },

    // ---------------------------------------------------------------- 8
    {
      title: "Build your own — the rules",
      html: `
<p>Three versions of one program, each one small, each one tested before the next. This is honestly how
games get made — nobody writes the whole brain at once. Select <span class="code">cannon</span>, add a
<b>📜 Code</b> section in its Script panel, and build up:</p>`,
      steps: [
        {
          text: `<b>Version 1 — steering.</b> Put exactly this in the Code section:
<pre class="codeblock">when start
  set flying to 0
  say "A AND D SLIDE THE SHOT" for 3
end

when tick
  if flying == 0 then
    if keydown("a") then
      change self.x by -4
    end
    if keydown("d") then
      change self.x by 4
    end
  end
end</pre>
          <span class="hint">Reading it with chapter-5 eyes: a start card that sets one mood box, and a
          heartbeat card whose bouncer only lets steering happen on the pad.
          <span class="code">keydown("a")</span> is new — it's true the whole time the key is HELD, which
          is what sliding wants (when-key fires once per press; keydown holds the door open).</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            return !!(c && scriptText(c).includes("keydown") && scriptText(c).includes("flying"));
          }
        },
        {
          text: `<b>▶ Test version 1.</b> A and D slide your cannon along the bottom. That's it — and
          that's the point: <b>one working rule beats ten imagined ones.</b> Stop the test.`,
          check: (ctx) => ctx.testCount >= 2
        },
        {
          text: `<b>Version 2 — launch and hit.</b> Replace the WHOLE Code section with this (it contains
          v1 plus the new cards — replacing whole versions keeps you out of find-the-missing-line misery):
<pre class="codeblock">when start
  set flying to 0
  set score to 0
  say "A/D AIM · SPACE FIRES" for 4
end

when key "Space"
  if flying == 0 then
    set flying to 1
  end
end

when tick
  if flying == 0 then
    if keydown("a") then
      change self.x by -4
    end
    if keydown("d") then
      change self.x by 4
    end
  end
  if flying == 1 then
    change self.y by -6
    if target1.visible == 1 and dist(self, target1) < 22 then
      explode target1
      set target1.visible to 0
      change score by 1
      say "HIT!" for 1
      set flying to 2
    end
    if self.y < -10 then
      set flying to 2
    end
  end
  if flying == 2 then
    set flying to 0
    set self.y to 320
  end
end</pre>
          <span class="hint">Every piece is from chapter 5 or 6: Space flips the mood to 1 (writing a
          number IS firing, remember); mood 1 climbs 6 a tick (negative-is-up again) and runs the
          dist-circle hit; off the top = mood 2; mood 2 resets to the pad. One new box:
          <span class="code">score</span> — and that name is special, which pays off in two steps.</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            if (!c) return false;
            const s = scriptText(c);
            return s.includes("dist(self, target1)") && s.includes("explode") && s.includes("score");
          }
        },
        {
          text: `<b>Version 3 — the target comes back.</b> One change inside the hit: instead of hiding the
          target forever, teleport it somewhere new. Replace the hit's
          <span class="code">set target1.visible to 0</span> line with these two:
<pre class="codeblock">      set target1.x to rand(60, 420)
      set target1.y to rand(50, 160)</pre>
          <span class="hint"><span class="code">rand(60, 420)</span> picks a random number in that range —
          and randomness is the whole reason the game stays alive instead of ending after one shot. Notice
          you also just deleted a rule (the hiding) and the game got BETTER. Removing rules is design
          too.</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            return !!(c && scriptText(c).includes("rand("));
          }
        },
        {
          text: `<b>Give it an ending — and earn the leaderboard.</b> Select your
          <span class="code">title</span> object, open <b>✨ Add behavior…</b> in its Script panel, pick
          <b>⏱ Coin timer</b>. Sixty seconds, then the play truly ends. <span class="hint">Here's the
          payoff: your game now counts a box named <span class="code">score</span> AND ends its plays —
          and that combination makes the platform give it a <b>public ★ high-score table automatically</b>.
          (Behaviors are ready-made rule-cards — open what it inserted and read it; it's when/do all the
          way down.)</span>`,
          check: (ctx) => ctx.objects.some(o => scriptText(o).includes("endplay"))
        },
        {
          text: `<b>▶ Test the finished machine.</b> Sixty seconds on the clock — set the score to beat.`,
          check: (ctx) => ctx.testCount >= 3
        }
      ]
    },

    // ---------------------------------------------------------------- 9
    {
      title: "Finish line",
      html: `
<p><b>Look at what you have.</b> Things with properties. Rules on when-cards. Variables, a mood box, a
condition with a bouncer, a dist-circle hitbox, randomness, an explosion, an arcade-grade ending. Those
aren't beginner topics — they are the SAME ideas every machine in the museum runs on. The other courses
just stack them higher, and now every one of them has a name in your head.</p>
<p><b>Three things worth doing before you go:</b></p>
<p>① In the Script panel press <b>🧱 To blocks</b> — your typed program becomes draggable blocks. Press
<b>📜 To code</b> and it's text again. Same program, two outfits — now you've seen it with your own eyes.</p>
<p>② Change ONE number and Test. The <span class="code">-6</span> climb speed, the <span class="code">22</span>
hit circle, the rand ranges. Feel the game change character. <b>Tuning numbers is half of all game
design</b>, and it's the half you can do forever.</p>
<p>③ <b>Publish it.</b> Type a description, rate it <b>E</b> (nothing in it is louder than an explosion of
light), and hit <b>💾 Save</b> — your machine goes live on the Games page with its own high-score table,
playable by anyone on earth. Then open your normal
<a href="studio/studio.html" target="_blank" rel="noopener" style="color:#ff8f8c">Studio</a> any time —
it's under <b>My Games</b>, yours to grow forever.</p>
${deeper(`keep climbing: the <a href="guide.html#recipes" target="_blank" style="color:#ff8f8c">guide's
Recipes</a> turn today's ideas into ships, gravity and win conditions;
<a href="guide.html#expressions" target="_blank" style="color:#ff8f8c">Expressions</a> is the full toolbox
dist() and rand() came from; and for the history you just touched, the
<a href="museum.html" target="_blank" style="color:#ff8f8c">Museum</a> runs 1947 to 1982.`)}
<p class="hint">The course is complete the moment every step is green — publishing is the victory lap, not
the exam. Course 2, <b>Bertie the Brain (1950)</b>, teaches the next leap: a machine that <i>thinks back</i>.</p>`
    }
  ]
};
