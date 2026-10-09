// course-crt.js — COURSE 1: the CRT Amusement Device (1947).
// The museum's first machine is also the first lesson: what a game IS, how the
// Studio works, and a whole game of your own by the end — written for someone
// who has never touched a game editor or a line of code in their life.
//
// The course runs inside its own Studio (studio.html?course=crt): the lesson
// is a panel, the editor around it is real, and the build steps verify
// themselves against the actual workspace. Checks receive a ctx:
//   { objects, fresh, testCount, published }
// and must stay true however the player writes the program — typed code or
// blocks — so they search the script's JSON, which both forms live in.

const scriptText = (o) => JSON.stringify(o.script || []);
const byName = (ctx, name) => ctx.objects.find(x => (x.name || "").toLowerCase() === name);

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
Nobody here assumes you can code — because the first video game makers couldn't either. Code didn't
exist yet. They had the same thing you have: an idea and a screen.</p>
<p>Here's the whole secret, the one every game ever made is built on:</p>
<p style="text-align:center"><b>a game = things on a screen + rules for how they act.</b></p>
<p>That's it. Pong is two paddles, a ball, and rules. The biggest game you've ever played is a million
things and a million rules — but it's the same sentence. This course teaches you the sentence.</p>
<p><b>How this works:</b> this panel is the lesson; everything around it is a real, full Studio — yours.
It's a separate workspace, so anything you were building in your normal Studio is safe. When the course
asks you to do something, <b>it watches the workspace and ticks the step itself</b> the moment you've
really done it. No skipping ahead by clicking checkboxes — when a step turns green, it's because you
made it true.</p>
<p>By the end of this course you will have: read the oldest video game ever patented, understood exactly
how it thinks, and <b>built and published a working machine of your own.</b> Press <b>Next ▸</b>.</p>`
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
Goldsmith and Mann's idea: let a player <b>steer that dot</b> with knobs, like aiming an artillery
shell, and try to land it on a target.</p>
<p>Three things to know about it, because all three still matter:</p>
<p>① <b>The targets weren't on the screen.</b> The machine could only draw the one glowing dot — so the
targets were printed on <b>plastic sheets taped to the glass</b>. The first video game had paper DLC.</p>
<p>② <b>A hit was an explosion of focus.</b> Land the dot on a target and the beam <i>defocused</i> —
the sharp dot bloomed into a fuzzy blast, like a shell going off. The first special effect.</p>
<p>③ <b>It was never sold.</b> Patented in 1948, demonstrated, and then… nothing. The world wasn't
ready, parts were expensive, and the two engineers went back to building televisions. Video games then
waited <b>ten more years</b> for the next attempt.</p>
<p>So the oldest video game is a ghost: it exists as a patent diagram and a handful of prototypes. Which
is why the museum rebuilt it — and why you're about to.</p>`
    },

    // ---------------------------------------------------------------- 2
    {
      title: "A machine with no computer",
      html: `
<p>Here's the part that breaks people's brains: the 1947 machine had <b>no computer</b>. No chip, no
memory, no program. Computers existed — barely — but they filled rooms and belonged to armies.</p>
<p>So how did it work? <b>The circuits were the rules.</b></p>
<p>The knobs charged capacitors; the capacitors bent the electron beam; the beam's arc across the screen
WAS the "physics." Nothing calculated the missile's path — the path was just what electricity does when
you wire it that way. If you wanted different rules, you didn't edit a file. You got out a soldering
iron.</p>
<p>Keep that picture, because it explains the next thirty years of this museum: every machine until 1975
(Pong included!) works this way — <b>wired logic</b>, rules made of copper. The reason old games feel so
pure is that every rule had to be built by hand out of parts.</p>
<p>And it explains why what YOU have is a superpower. In the Studio, a rule is a sentence:
<span class="code">change self.y by vy</span>. Goldsmith needed a capacitor, a vacuum tube and an
afternoon; you need nine keystrokes. Same rule. Your soldering iron is a keyboard.</p>
<p>Now let's open our rebuild of their machine and read its wiring.</p>`
    },

    // ---------------------------------------------------------------- 3
    {
      title: "Our version, opened up",
      html: `
<p>Press this button to load the museum's CRT Amusement Device into the workspace:</p>
<p><button class="btn btn-small" data-act="load-example">⬇ Load the museum's CRT machine</button></p>
<p>Look at the <b>Explorer</b> panel (the list of objects). Our whole 1947 machine is <b>six things</b>:</p>
<pre class="codeblock">missile     a Dot — the glowing beam spot you steer
target1-3   three Rings — the "plastic overlay" targets
hud         a Text — the aim/hits readout
aimline     a tiny Dot that shows your aim angle</pre>
<p><b>Click <span class="code">missile</span> in the Explorer.</b> Two panels wake up: <b>Properties</b>
(its x, y, size, color — the "what it is") and <b>Script</b> (the "how it acts"). Everything you will
ever make is those two halves.</p>
<p>Read the missile's script top to bottom — it's the 1947 wiring, translated:</p>
<pre class="codeblock">when start        "when the game begins" — set aim to -5, hits to 0.
                  A VARIABLE is just a named number the game remembers.
when key ArrowUp  the aiming knob: nudge the aim variable by -0.5 —
when key ArrowDn  but ONLY if flying == 0 (you can't re-aim a shell
                  that's already in the air; that's an IF: a rule
                  with a condition on it)
when key Space    FIRE: set flying to 1, give it vertical speed vy
when tick         60 times every second: IF flying, move the dot —
                  x forward, y by vy — and add 0.12 to vy each tick.
                  That one line IS gravity. Then: if the dot is near
                  a target (dist() measures it), explode it.</pre>
<p>Match it to 1947: the knobs became <span class="code">when key</span>. The capacitor's arc became
<span class="code">set vy to vy + 0.12</span>. The defocused beam became
<span class="code">explode target1</span>. <b>The rules are identical — only the material changed.</b></p>
<p><b>Prove it's real:</b> hit <b>▶ Test</b> and play it (Up/Down aim, Space fires). Then stop the test,
find <span class="code">change self.x by 4</span> in the when-tick code, make the 4 an 8, and Test
again. Twice the muzzle velocity — you just did, in five seconds, what would have cost Goldsmith a new
circuit. <i>That's editing a game. You've now done it.</i></p>`
    },

    // ---------------------------------------------------------------- 4
    {
      title: "Build your own",
      html: `
<p>Now the real thing. You're going to build <b>your own target game</b> — same 1947 idea, but yours:
your cannon fires <b>upward</b>, your target <b>comes back for more</b>, and your machine will have the
one thing Goldsmith never got: <b>a public high-score table.</b></p>
<p>Every step below ticks itself when the workspace matches. Scripts are given whole — read the gray
notes to know what each line is doing, then make them yours.</p>`,
      steps: [
        {
          text: `<b>Start fresh.</b> <button class="btn btn-small" data-act="start-fresh">🧹 Clear the workspace</button>
          — the museum machine's job is done.`,
          check: (ctx) => ctx.fresh
        },
        {
          text: `<b>Give your game a name — on screen.</b> In the Explorer press <b>+ Text</b>. In
          Properties: set <b>name</b> to <span class="code">title</span>, type your game's name into
          <b>text</b> (anything — it's YOUR machine), and drag it near the top of the screen.`,
          check: (ctx) => {
            const t = byName(ctx, "title");
            return !!(t && t.type === "text" && String(t.text || "").trim().length > 0 && t.y < 140);
          }
        },
        {
          text: `<b>Add the target.</b> Press <b>+ Ring</b>, name it <span class="code">target1</span>
          (exactly — your script is about to talk to it by name), and drag it into the top half of the
          screen.`,
          check: (ctx) => {
            const t = byName(ctx, "target1");
            return !!(t && t.type === "ring" && t.y < 190);
          }
        },
        {
          text: `<b>Add the cannon.</b> Press <b>+ Dot</b>, name it <span class="code">cannon</span>,
          and put it at the bottom middle — about <b>x 240, y 320</b> (type the numbers straight into
          Properties; that's what they're for).`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            return !!(c && c.type === "dot" && c.y > 260 && c.x > 140 && c.x < 340);
          }
        },
        {
          text: `<b>Give it a brain.</b> With <span class="code">cannon</span> selected, add a
          <b>📜 Code</b> section in the Script panel and put this in — the whole program, with what every
          part is for underneath:
<pre class="codeblock">when start
  set aim to 0
  set score to 0
  set flying to 0
  say "AIM: A/D · FIRE: SPACE" for 4
end

when key "Space"
  if flying == 0 then
    set flying to 1
  end
end

when tick
  if flying == 0 then
    if keydown("a") then
      change aim by -0.2
    end
    if keydown("d") then
      change aim by 0.2
    end
  end
  if flying == 1 then
    change self.y by -5
    change self.x by aim
    if target1.visible == 1 and dist(self, target1) < 22 then
      explode target1
      change score by 1
      say "HIT!" for 1
      set flying to 2
    end
    if self.y < -10 or self.x < -10 or self.x > 490 then
      set flying to 2
    end
  end
  if flying == 2 then
    set flying to 0
    set self.x to 240
    set self.y to 320
  end
end</pre>
          <span class="hint">Reading it: <b>aim</b>, <b>score</b>, <b>flying</b> are variables — named
          numbers. <b>flying</b> is the machine's mood: 0 = on the pad (keys steer the aim), 1 = in the
          air (the shell flies up 5 a tick and drifts sideways by your aim), 2 = "that one's over, reset
          me." <b>dist(self, target1) &lt; 22</b> is the hit — it measures the gap between shell and
          ring. <b>explode</b> is Goldsmith's defocused beam. The resets at the bottom put the shell
          back on the pad. (If you placed your cannon somewhere else, make the two reset numbers match
          your spot.)</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            if (!c) return false;
            const s = scriptText(c);
            return s.includes("keydown") && s.includes("flying") && s.includes("dist(self, target1)")
              && s.includes("explode") && s.includes("score");
          }
        },
        {
          text: `<b>▶ Test it.</b> A/D sets your drift, SPACE fires, hit the ring. (It only explodes
          once — we'll fix that next, and that's on purpose: builds grow one rule at a time.)`,
          check: (ctx) => ctx.testCount >= 1
        },
        {
          text: `<b>Make the target come back.</b> In the hit section of your code, right after
          <span class="code">change score by 1</span>, the target should respawn somewhere new instead of
          staying dead. Replace the hit section so it reads:
<pre class="codeblock">    if target1.visible == 1 and dist(self, target1) < 22 then
      explode target1
      change score by 1
      say "HIT!" for 1
      set target1.x to rand(60, 420)
      set target1.y to rand(50, 160)
      set flying to 2
    end</pre>
          <span class="hint"><b>rand(60, 420)</b> picks a random number in that range — the whole reason
          the game stays alive. Notice the target never turns invisible now, it just teleports: one less
          rule to manage. Deleting rules is design too.</span>`,
          check: (ctx) => {
            const c = byName(ctx, "cannon");
            return !!(c && scriptText(c).includes("rand("));
          }
        },
        {
          text: `<b>Give it an ending — and earn the leaderboard.</b> A 1947 machine ran until the fair
          closed; an arcade machine ends so the next coin matters. Select your <span class="code">title</span>
          object, open <b>✨ Add behavior…</b> and pick <b>⏱ Coin timer</b>. Sixty seconds, then the play
          truly ends — and because your game now counts <span class="code">score</span> AND ends its
          plays, <b>the platform gives it a public ★ high-score table automatically.</b> That's the house
          rule you'll use in every course after this one.`,
          check: (ctx) => ctx.objects.some(o => scriptText(o).includes("endplay"))
        },
        {
          text: `<b>▶ Test the finished machine.</b> Sixty seconds on the clock — set the score to beat.`,
          check: (ctx) => ctx.testCount >= 2
        }
      ]
    },

    // ---------------------------------------------------------------- 5
    {
      title: "Finish line",
      html: `
<p><b>Look at what you have.</b> Objects with properties, events with rules, variables, a condition, a
random number, an explosion, an economy-grade ending. That's not "baby's first demo" — those are the
SAME six ideas every machine in the museum is made of. The other 56 courses just stack them higher.</p>
<p><b>Two things worth trying before you go:</b></p>
<p>① In the Script panel press <b>🧱 To blocks</b> — your typed program becomes draggable blocks. Press
<b>📜 To code</b> and it's text again. <i>Same program, two views.</i> Blocks are training wheels you
never have to be embarrassed about, and code is blocks with the covers off.</p>
<p>② Change ONE number — the <span class="code">-5</span> climb speed, the <span class="code">22</span>
hit distance, the timer — and Test. Feel how the game changes character. Tuning numbers is half of all
game design.</p>
<p><b>Publish it.</b> Type a description, rate it <b>E</b> (nothing in it is louder than an explosion of
light), and hit <b>💾 Save</b> — your machine goes live on the Games page with its own high-score
table, playable by anyone on earth. Then open your normal
<a href="studio.html" target="_blank" rel="noopener" style="color:#ff8f8c">Studio</a> any time — the
game is under <b>My Games</b>, yours to grow forever.</p>
<p class="hint">Publishing is the victory lap, not the exam — the course is complete the moment every
build step above is green. Course 2, <b>Bertie the Brain (1950)</b>, teaches a machine that thinks back.</p>`
    }
  ]
};
