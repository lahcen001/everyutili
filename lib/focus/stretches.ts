export interface Stretch {
  title: string;
  how: string;
  seconds: number;
  /** a simple emoji used as the illustration */
  icon: string;
}

export interface Routine {
  id: string;
  name: string;
  blurb: string;
  steps: Stretch[];
}

export const ROUTINES: Routine[] = [
  {
    id: "desk",
    name: "Desk reset",
    blurb: "A quick head-to-toe loosen-up",
    steps: [
      { title: "Sit tall and breathe", how: "Feet flat on the floor, shoulders down. Take slow, deep breaths.", seconds: 20, icon: "🧘" },
      { title: "Neck tilt — left", how: "Drop your left ear toward your left shoulder. Keep the other shoulder relaxed.", seconds: 20, icon: "🙆" },
      { title: "Neck tilt — right", how: "Now the right ear toward the right shoulder. Breathe slowly.", seconds: 20, icon: "🙆" },
      { title: "Shoulder rolls", how: "Roll both shoulders up, back and down in big, slow circles.", seconds: 25, icon: "🔄" },
      { title: "Seated twist — left", how: "Turn your upper body to the left, holding the back of the chair. Sit tall.", seconds: 20, icon: "🌀" },
      { title: "Seated twist — right", how: "Turn to the right and hold. Keep both hips on the seat.", seconds: 20, icon: "🌀" },
      { title: "Reach for the sky", how: "Interlace your fingers, press your palms up and stretch tall.", seconds: 20, icon: "🙌" },
      { title: "Stand and shake out", how: "Stand up, shake your arms and legs loosely, and take a sip of water.", seconds: 20, icon: "💧" },
    ],
  },
  {
    id: "neck",
    name: "Neck & shoulders",
    blurb: "For tight necks after long reading",
    steps: [
      { title: "Chin tuck", how: "Slide your chin straight back, like making a double chin. Hold gently.", seconds: 20, icon: "🙂" },
      { title: "Neck tilt — left", how: "Left ear toward left shoulder. Let the weight of your head do the work.", seconds: 25, icon: "🙆" },
      { title: "Neck tilt — right", how: "Right ear toward right shoulder. Breathe out slowly.", seconds: 25, icon: "🙆" },
      { title: "Look over each shoulder", how: "Turn your head to look over your left shoulder, then slowly over your right.", seconds: 30, icon: "👀" },
      { title: "Shoulder shrugs", how: "Lift both shoulders to your ears, hold for a second, then drop them.", seconds: 20, icon: "🤷" },
    ],
  },
  {
    id: "wrists",
    name: "Wrists & hands",
    blurb: "Relief after typing and writing",
    steps: [
      { title: "Wrist circles", how: "Make fists and rotate your wrists slowly, both directions.", seconds: 25, icon: "🔄" },
      { title: "Prayer stretch", how: "Press your palms together in front of your chest and lower them slowly.", seconds: 20, icon: "🙏" },
      { title: "Finger stretch", how: "Spread your fingers wide, hold, then close into a fist. Repeat.", seconds: 25, icon: "✋" },
      { title: "Forearm stretch", how: "Extend one arm, palm up, and gently pull your fingers back. Then switch.", seconds: 30, icon: "💪" },
    ],
  },
  {
    id: "eyes",
    name: "Eye rest 20-20-20",
    blurb: "Every 20 minutes, look 20 feet away for 20 seconds",
    steps: [
      { title: "Look far away", how: "Look at something at least 6 metres (20 feet) away. Let your eyes relax.", seconds: 20, icon: "🏔️" },
      { title: "Blink slowly", how: "Close your eyes tightly, then open. Repeat ten times to refresh them.", seconds: 15, icon: "😌" },
      { title: "Trace a figure eight", how: "With your eyes only, draw a big sideways 8 in the air. Reverse direction.", seconds: 25, icon: "♾️" },
    ],
  },
];

export const routineSeconds = (r: Routine): number => r.steps.reduce((s, x) => s + x.seconds, 0);
