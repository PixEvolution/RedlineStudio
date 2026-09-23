// terminal.js — the input row for teletype games (print / when answer).
// Any harness (Studio test, play page, exported standalone) calls
// attachTerminalInput(engine, container): if the game uses the terminal,
// a text field + SEND button appear under the screen. Typing in the field
// never leaks into the game's key events (the engine ignores keys aimed at
// real inputs). Returns { destroy } either way.

export function attachTerminalInput(engine, container) {
  if (!engine.usesTerminal || !engine.usesTerminal()) return { destroy() {} };

  const row = document.createElement("div");
  row.className = "term-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "term-input";
  input.placeholder = "Type your answer, then Enter…";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;

  const btn = document.createElement("button");
  btn.className = "btn term-send";
  btn.textContent = "SEND";

  const send = () => {
    const text = input.value.trim();
    if (text === "") return;
    engine.submitAnswer(text);
    input.value = "";
    input.focus();
  };
  btn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); send(); }
    e.stopPropagation();   // belt AND suspenders: nothing typed reaches the game
  });

  row.append(input, btn);
  container.appendChild(row);
  return {
    destroy() { row.remove(); }
  };
}
