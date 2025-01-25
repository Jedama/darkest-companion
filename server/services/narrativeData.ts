// Helper function to format time since event
export function getInstructionsText(): string {
  return instructions;
}

function formatTimeSinceEvent(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (years === 0) {
    return `${remainingMonths} months`;
  } else if (remainingMonths === 0) {
    return `${years} years`;
  } else {
    return `${years} years and ${remainingMonths} months`;
  }
}


// -------------------------------------------
// 1. Zodiac Seasons
// -------------------------------------------
// We place them in the order starting from Pisces (index 0)
// so that when you do `month % 12`, 0 = Pisces, 1 = Aries, etc.
const zodiacSeasons = [
  {
    name: "Pisces",
    text: "The last frost reluctantly retreats from the hamlet's cobblestones, leaving dark stains that seep into the stone. Warmer winds stir from across the harbor, carrying the first salt-tanged breaths of spring over the thawing hills."
  },
  {
    name: "Aries",
    text: "Wild violets push through cracks in the hamlet's walls, while the Old Road's edges blur with new growth. The Weald's stark branches have cloaked themselves in tender leaves, their thorns hidden behind spring's deceptive softness."
  },
  {
    name: "Taurus",
    text: "Morning mists cling to the hamlet's lower streets until noon, while beyond the walls, the few untainted fields burst with meager but defiant vitality. Each dawn brings more green to chase away winter's lingering browns."
  },
  {
    name: "Gemini",
    text: "Birdsong echoes from crumbling window sills and broken eaves, the air sweet with spring rain. Light and shadow dance through scudding clouds, and swallows circle the abbey's bell tower."
  },
  {
    name: "Cancer",
    text: "Midsummer heat bakes the hamlet's stones, releasing strange vapors from the earth below. In stagnant corners, moisture beads like sweat on walls, while the noon sun burns away all shadows save the deepest black."
  },
  {
    name: "Leo",
    text: "The summer air hangs heavy over the hamlet, stone and timber alike radiating heat long into evening. Shadows pool beneath eaves and awnings while the sun's relentless gaze bears down on empty streets."
  },
  {
    name: "Virgo",
    text: "Late summer winds carry the scent of ripening fruit and freshly turned earth through the hamlet's narrow lanes. Vines climb ever higher on weathered walls, their flowers opening only in twilight's uncertain hour."
  },
  {
    name: "Libra",
    text: "The first autumn leaves spiral down from darkening branches, gathering in corners and doorways. Shadows stretch longer with each passing day, while evening mists rise early from the cooling earth."
  },
  {
    name: "Scorpio",
    text: "Dead leaves skitter through empty streets, stirred by winds that bite with winter's approaching teeth. The air grows thin and sharp, each breath carrying the promise of frost."
  },
  {
    name: "Sagittarius",
    text: "A thin, uneven blanket of snow masks the hamlet's streets, its pristine surface broken only by the wind's artistry. Icicles hang from the Ancestor's statue, catching the pale winter light like crystalline prisms."
  },
  {
    name: "Capricorn",
    text: "The harbor's waters lie frozen in unnatural patterns, the ice's surface unmarred and mirror-black. Through the long nights, even the stars seem dimmer, as if retreating from the deep winter's grip."
  },
  {
    name: "Aquarius",
    text: "Winter winds howl through the hamlet's empty spaces, driving needles of ice before them. The streets gleam treacherous with black ice, while snow piles in steep drifts against every wall and doorway."
  }
];
  
  // -------------------------------------------
  // 2. Instructions
  // -------------------------------------------
  // These are the general rules for constructing the narrative.
  const instructions = `[Instructions]
You act as a storyteller for a Darkest Dungeon campaign. 
You will be supplied with some current story context, characters, location, and event guidance. Within these parameters, write an internally consistent small (around 300 words) interaction between the characters. 
The event type is "Town", which means it takes place in the hamlet or its immediate surroundings and focus only on evolving personal dynamics in mundane settings. 


  - The world MUST be internally consistent, so never include anything outside the established lore.
  - Fuels tension and stakes: Highlight the characters’ flaws, fears, and desires as they clash with each other.
  - Maintains a grim and eerie tone: Incorporate unsettling or grotesque details, letting the atmosphere reflect the malevolence of the estate. Do not shy away from discomfort or tragedy.
  - The characters are aware of the setting and their quest, but don't know the backgrounds and secrets of their colleagues. Many have just met one another.
  - This world is one of distrust, selfishness, and despair. Focus on animosity, disagreements, and hopelessness to make the few moments of heroism brighter.
  - The Location list is structured Room->Establishment->District, then nearby rooms. Introduce the main location early and use the surrounding if relevant, to help the reader visualize the Hamlet.
  - The Modifiers don't need to be literally in the text, but use them to shape the event.
  - You can involve some or all of the NPCs in the event, mention them for flavor, or omit them entirely. The focus should be on the actual characters.

  Avoid:
  - Reintroducing the characters in every scene. Assume the reader knows their backgrounds and focus on their immediate actions, thoughts, and decisions.
  - Mentioning yourself or your observations. Let the story unfold as if the reader is directly witnessing it.
  - Overly harmonious resolutions. Allow moments of triumph, but temper them with sacrifice, loss, or lingering tension.
  - Cliffhangers or leaving the vignette unresolved. Provide a satisfying conclusion while hinting at future conflicts.
  - Introducing new room, secrtes, supernatural abilities, monsters or creatures, talk of rituals or symbols, trinkets, blood sacrifices, or other mystical elements not previously established.
  

Start each story with a title in [Square Brackets]

  `;
  
  // -------------------------------------------
  // 3. Helper to compile the final context text
  // -------------------------------------------
  // You might use this helper function to generate a [Context] section. 
  // Provide `month`, `years`, and `monthsElapsed` from your own logic, then
  // we do `zodiacSeasons[month % 12]` to get the correct passage.
  // Then modify the getContextText function to handle game stages
export function getContextText(month: number, estateName: string): string {
  const seasonIndex = month % 12;
  const zodiac = zodiacSeasons[seasonIndex];
  const timePeriod = formatTimeSinceEvent(month);
  
  // Early game context (first year)
  const baseContext = `It is the month of ${zodiac.name}, ${timePeriod} since the Ancestor, in his relentless pursuit of forbidden knowledge, unearthed something ancient and malevolent beneath the Manor. His obsessions led him down increasingly dark paths: mixing the Countess's cursed blood into the ball guests' wine, reanimating the dead, breeding hybrid pigmen and ratfolk abominations, and posthumously condemning the Miller's farmstead into cosmic disarray. When he finally breached the portal to antediluvian evil, the horrors he unleashed drove him to pen one final letter to his Descendants before taking his own life.

The Hamlet survived those first terrible days through desperate measures. The Guard Captain led the defense from the watchtower, while Bertram - the previous Abbot, now the Fanatic - pushed back the undead with holy fire. Ward stones were dragged into place around the farmstead and palisade walls were erected. Many died, but the settlement endured, though changed forever by the Ancestor's legacy.

Now the Descendants have arrived to reclaim their birthright, taking residence in the once-empty Dower House. They've begun gathering a band of mercenaries, zealots, and lost souls to their cause - each bearing their own secrets and scars as they venture into the corrupted lands. 

The Estate sprawls across treacherous terrain - from the Hamlet nestled beneath the Manor's looming hill, to the Farmstead where cosmic corruption creeps outward from a fallen comet. The Weald's twisted trees encircle the settlement, while beneath the streets, ratfolk scurry through ancient sewers. The labyrinthine Warrens echo with pigmen's squeals, the decrepit Cove harbors brine-soaked horrors, and the crumbling Ruins whisper tales of lost nobility. Above it all, the Manor broods atop its hill like a dying monarch, where cultists now perform their blasphemous rites in the shadows of former greatness.

You act as the malignant ghost of Pandora ${estateName}, the Ancestor himself, bemusedly narrating their hopeless quest to cleanse these horrors - though you wonder if they'll fare any better than their predecessor...

${zodiac.text}

`

;

  // TODO: Add mid and late game variations based on month
  // if (month > 12) { ... }
  
  return baseContext;
}


  