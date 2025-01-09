// -------------------------------------------
// 1. Zodiac Seasons
// -------------------------------------------
// We place them in the order starting from Pisces (index 0)
// so that when you do `month % 12`, 0 = Pisces, 1 = Aries, etc.
const zodiacSeasons = [
    {
      name: "Pisces",
      text: `It is the season of Pisces, Y years and M months since the quest began, and the last frost clears from the cobblestones of the Hamlet’s streets. Warmer winds stir from the Eastern Isles, carrying the faint scent of salt over the thawing hills.`,
    },
    {
      name: "Aries",
      text: `It is the season of Aries, Y years and M months since the quest began, and wildflowers bloom along the Old Road, their colors a fragile promise of spring. The Weald’s brambly branches have disguised themselves in leaves, their thorns softened by new growth.`,
    },
    {
      name: "Taurus",
      text: `It is the season of Taurus, Y years and M months since the quest began, and the scarce fields untouched by the Farmstead’s corruption sprout with vibrant growth, stubborn against the shadow of decay.`,
    },
    {
      name: "Gemini",
      text: `It is the season of Gemini, Y years and M months since the quest began, and birdsong echoes from the Dower House’s crumbling window sills. The breeze carries the scent of fresh rain, and the sky hums with darting swallows.`,
    },
    {
      name: "Cancer",
      text: `It is the season of Cancer, Y years and M months since the quest began, and the waters of the Weald run thick with algae beneath the midsummer heat. Dragonflies hover above the murky ponds, their wings glinting in the dappled sunlight.`,
    },
    {
      name: "Leo",
      text: `It is the season of Leo, Y years and M months since the quest began, and the summer air is heavy with the scent of dry grass and wild blooms. In the Hamlet, shadows pool beneath eaves and awnings, offering brief respite from the sun’s relentless gaze.`,
    },
    {
      name: "Virgo",
      text: `It is the season of Virgo, Y years and M months since the quest began, and vines creep steadily up the Abbey’s weathered walls, their tendrils wrapping around the cracked stone. The air carries the faint smell of earth and ripened fruit from the nearby groves.`,
    },
    {
      name: "Libra",
      text: `It is the season of Libra, Y years and M months since the quest began, and the first leaves fall from the Gallows Tree, spiraling down with the brisk autumn wind. Shadows lengthen over the Hamlet as daylight fades earlier with each passing evening.`,
    },
    {
      name: "Scorpio",
      text: `It is the season of Scorpio, Y years and M months since the quest began, and dead leaves collect in the corners of the Hamlet’s streets, rustling with every gust of wind. The air is cool and dry, promising harsher weather yet to come.`,
    },
    {
      name: "Sagittarius",
      text: `It is the season of Sagittarius, Y years and M months since the quest began, and snow covers the Hamlet's streets in a thin, uneven blanket. Icicles hang from the Ancestor statue’s crossed arms, glinting faintly in the pale winter light.`,
    },
    {
      name: "Capricorn",
      text: `It is the season of Capricorn, Y years and M months since the quest began, and the sea beyond the Hamlet lies frozen solid, its surface silent and unbroken. The days grow short, with only a faint gray light lingering before the long, icy nights.`,
    },
    {
      name: "Aquarius",
      text: `It is the season of Aquarius, Y years and M months since the quest began, and biting winds howl across the Sunward’s cracked stone, sweeping snow into drifting mounds. The roads remain treacherous with ice and slush, though wagons still creak toward the Hamlet, their progress slow and unsteady.`,
    },
  ];
  
  // -------------------------------------------
  // 2. Instructions
  // -------------------------------------------
  // These are the general rules for constructing the narrative.
  const instructions = `[Instructions]
  Construct a vivid narrative vignette that:
  - Centers on a pivotal event: Describe a decisive moment where characters face conflict, danger, or a crucial decision that pushes them to their limits.
  - Drives meaningful consequences: Show how this moment shapes the relationships, fortunes, or fates of the characters, leaving a lasting impact on the narrative.
  - Fuels tension and stakes: Highlight the characters’ flaws, fears, and desires as they clash with each other and the horrors of the estate. Emphasize their inner struggles as much as external threats.
  - Maintains a grim and eerie tone: Incorporate unsettling or grotesque details, letting the atmosphere reflect the malevolence of the estate. Do not shy away from discomfort or tragedy.
  - Remember that not every character knows the backgrounds and secrets of the others. Many have just met one another.
  
  Avoid:
  - Reintroducing the characters in every scene. Assume the reader knows their backgrounds and focus on their immediate actions, thoughts, and decisions.
  - Mentioning yourself or your observations. Let the story unfold as if the reader is directly witnessing it.
  - Overly harmonious resolutions. Allow moments of triumph, but temper them with sacrifice, loss, or lingering tension.
  - Cliffhangers or leaving the vignette unresolved. Provide a satisfying conclusion while hinting at future conflicts.
  - Introducing new supernatural abilities, talk of rituals, trinkets, blood sacrifices, or other mystical elements not previously established.
  
  Start each story with a title in [Square Brackets]
  `;
  
  // -------------------------------------------
  // 3. Context
  // -------------------------------------------
  // Use the zodiac text, then add setting flavor and the Ancestor perspective.
  // Replace "Pandora Dantill" with "Pandora ${estate.estateName}" as requested.
  const contextIntro = `[Context]
  You are Pandora \${estate.estateName}, the Ancestor—a malignant spectral presence haunting your once-grand estate. 
  You observe, but never interfere, taking grim satisfaction in watching the struggles of the Descendants who have taken residence in the Dower House of the nearby Hamlet, poised to cleanse the corruption your brought upon this land.
  The Estate contains the Hamlet, the Farmstead and the corrupted fields that surround it, the Weald and the Old road passing through it, the rat-filled sewers beneath the streets, the labyrinthine pigmen-infested tunnels of the Warrens, the waterlogged Cove and its brine-soaked tidal horrors, the crumbling Ruins whose desecrated halls echo your family's lost eminence, and the Manor itself—a decaying stronghold now claimed by cultists, their blasphemous rituals illuminating the shadows of the Darkest Dungeon.
  The Descendants and their hired mercenaries, selfish and deeply distrustful of their employers and equals, set out for monthly forays into these lands, seeking to purge the unholy creatures that infest them, in the faint hopes of finding some meaning in their miserable lives.
  `;
  
  // -------------------------------------------
  // 4. Helper to compile the final context text
  // -------------------------------------------
  // You might use this helper function to generate a [Context] section. 
  // Provide `month`, `years`, and `monthsElapsed` from your own logic, then
  // we do `zodiacSeasons[month % 12]` to get the correct passage.
  export function getContextText(month: number, estateName: string): string {
    // Safeguard index within the array
    const seasonIndex = month % 12;
    const zodiac = zodiacSeasons[seasonIndex];

    // Calculate the elapsed years and months
    const years = Math.floor(month / 12);
    const months = month % 12;
    
    // Insert your Y years / M months into the zodiac text:
    const replacedZodiacText = zodiac.text
      .replace("Y years", `${years} years`)
      .replace("M months", `${months} months`);
  
    // Then build the final context block, e.g.:
    return `
  [Context]
  ${replacedZodiacText}

  ${contextIntro}
  `;
  }

  export function getInstructionsText(): string {
    return instructions;
  }
  