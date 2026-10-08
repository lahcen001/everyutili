export const PASSAGES = [
  "The best way to learn something new is to break it into small steps and practise a little every day.",
  "A quiet room, a clear desk and a cup of water can make a long study session feel much easier to start.",
  "Good notes are short and clear. Write the main idea in your own words, then add one example that you will remember.",
  "When your mind wanders, do not be hard on yourself. Notice it, take a slow breath and gently return to the page.",
  "Sleep is part of studying. The brain stores what you learned while you rest, so a good night helps more than extra hours.",
  "Reading aloud, drawing a diagram or teaching a friend are simple ways to check whether you really understand a topic.",
  "Small wins add up. Finish one paragraph, one problem or one page, and let that progress carry you into the next task.",
  "Take a short walk between sessions. Fresh air and movement give your eyes a rest and bring your focus back.",
];

export interface TypingStats {
  wpm: number;
  accuracy: number;
  correctChars: number;
  typedChars: number;
}

/** Words per minute (5 characters = 1 word) counting only correctly typed characters, and accuracy in %. */
export function typingStats(typed: string, target: string, seconds: number): TypingStats {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct += 1;
  const minutes = Math.max(seconds, 1) / 60;
  return {
    wpm: Math.round(correct / 5 / minutes),
    accuracy: typed.length === 0 ? 100 : Math.round((correct / typed.length) * 100),
    correctChars: correct,
    typedChars: typed.length,
  };
}
