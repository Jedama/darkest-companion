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

// Helper function to get the appropriate present day text based on month
export function getPresentDayText(month: number): string {
  if (month === 0) {
    return "The Descendants of house ${estateName} are currently traveling along the old road toward the hamlet, having received the Ancestor's letter and inherited the estate. Unaware of the true horrors that await, they journey with a mix of trepidation and determination to reclaim their family legacy.";
  } else if (month === 1) {
    return "The Descendants of house ${estateName} have just arrived and taken residence in the Dower House. Still unpacking their belongings, they are struggling to make sense of the desolation around them - the haunted looks of villagers, the crumbling buildings, and whispers of horrors beyond the hamlet's borders. They've begun gathering information from the Caretaker and townsfolk about what transpired after the Ancestor's death, slowly piecing together the extent of the corruption. No expeditions have been mounted yet; preparations are still underway for the dangers that lie beyond the hamlet's protective walls.";
  } else if (month === 2) {
    return "An expedition into the ruins beneath the ancestral home has been completed. Those who returned witnessed firsthand the terrible truth - the walking dead and fanatical cultists now inhabit what was once the ${estateName} family stronghold. This grim reality has hardened resolve at the estate. The first heroes - broken souls seeking redemption or fortune - have been recruited, establishing a tenuous foothold in the hamlet. The Dower House serves as the base of operations for planning the next foray into the corrupted lands, the monumental task ahead now becoming clear.";
  } else {
    return "Several expeditions have ventured into the corrupted regions surrounding the hamlet. Each journey reveals new challenges, but also yields treasures and knowledge vital to the cause. The roster of heroes has begun to grow as word spreads of the effort to reclaim the Estate. Though each hero arrives bearing their own scars and stories, all seek purpose in this grim endeavor. A strategy room has been established in the town hall, where maps are marked with known dangers and the hamlet's leaders debate which threat to confront next. The darkness is vast, but the first steps have been taken toward reclaiming the estate from its corruption.";
  }
}
  
  // -------------------------------------------
  // 2. Instructions
  // -------------------------------------------
  // These are the general rules for constructing the narrative.
  const instructions = `[Instructions]
You act as a storyteller for a Darkest Dungeon campaign.
You will be supplied with some current story context, characters, location, and event guidance. Within these parameters, write an internally consistent small (around 300 words) interaction between the characters. 
The event type is "Town", which means it takes place in the hamlet or its immediate surroundings and focus only on evolving characters and their dynamics in mundane settings. 

  - The world MUST be internally consistent, so never include anything outside the established lore.
  - Show the characters intents, thoughts, and feelings through gestures and interactions with the environment, rather than simply telling them.
  - Fuels tension and stakes: Focus on immediate personal conflicts and character flaws clashing in the present moment. Show how characters' different approaches to the same situation create natural friction.
  - Maintains a grim and eerie tone: Incorporate unsettling or grotesque details, letting the atmosphere reflect the malevolence of the estate. Do not shy away from discomfort or tragedy.
  - The characters are aware of the setting and their quest, but don't know the backgrounds and secrets of their colleagues. Many have just met one another.
  - This world is one of distrust, selfishness, and despair. Focus on animosity, disagreements, and hopelessness to make the few moments of heroism brighter.
  - The Location list is structured Room->Establishment->District, then nearby rooms. Introduce the main location and its establishment or surroundings early, to help the reader visualize the Hamlet.
  - The Modifiers don't need to be literally in the text, but use them to shape the event.
  - You can involve some or all of the NPCs in the event, mention them for flavor, or omit them entirely. The focus should be on the actual characters.
  - When a character is marked as (referenced only) focus on how their absence, memory, or influence affects the present character(s).
  - Each vignette should show a small but meaningful moment of character development through their interactions with others. These can be subtle - a change in attitude, a moment of understanding, or a reinforcement of existing traits through action.

  Avoid:
  - Reintroducing the characters in every scene. Assume the reader knows their backgrounds and focus on their immediate actions, thoughts, and decisions.
  - Mentioning yourself or your observations. Let the story unfold as if the reader is directly witnessing it.
  - Overly harmonious resolutions. Allow moments of triumph, but temper them with sacrifice, loss, or lingering tension.
  - Cliffhangers or leaving the vignette unresolved.
  - Avoid introducing new mysteries, undocumented past events, unexplained phenomena, or plot hooks that extend beyond the current scene. Focus on the immediate interactions and character dynamics rather than setting up future revelations.
  - Always ending storeis on a positive note. This is a game of managing broken, horrible people and difficulty is the primary selling point.

Start each story with a title in [Square Brackets], no #.

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
  const presentDayText = getPresentDayText(month);
  
  // Early game context (first year)
  const baseContext = `
SETTING: The Estate - once a noble family holding, now a corrupted land containing the Manor, Hamlet, and surrounding regions

BACKSTORY:
The Ancestor, Pandora ${estateName}, was born to a noble family in decline. Upon inheriting the estate, he hosted extravagant parties for nobility in the Courtyard where decadence and debauchery flourished. Growing tired of these parasitic nobles, he encountered a Countess who revealed herself as a blood-drinking monster. After killing her, he mixed her blood into wine served at his gatherings, transforming the guests into similar creatures.

When a drop of this blood touched the Ancestor's lips, he received a vision of something ancient sleeping beneath the Manor. Obsessed with this revelation, he began excavating beneath his home, hiring workers and acquiring occult artifacts through mariners who sailed to distant shores.

As the excavation progressed, the Ancestor conducted increasingly disturbing experiments:
- Practiced necromancy and blood magic
- Created hybrid creatures using pig flesh (creating the Swine)
- Collaborated with the young Horticulturist who later transformed through fungal experiments (becoming the Hag)
- Discovered ancient aqueducts and tunnels (the Warrens) where he disposed of failed experiments
- Erected celestial slabs at the Miller's farmstead that later attracted a cosmic entity

When his fortune began to dwindle, the Ancestor took desperate measures:
- Made deals with sea creatures by sacrificing the Waif in the Cove (Later known as the Siren)
- Sank the mariners' ship when they demanded more payment
- Hired brigands to massacre protesting townsfolk
- Raised an army of undead in the ruins of his ancestral castle

Eventually, the excavation reached "the Darkest Dungeon," revealing an eldritch entity. After showing this to a Prophet (who went mad and blinded himself), the Ancestor retreated to his study. As townsfolk stormed the Manor, he wrote letters to his heir, then ended his life - not in despair, but as the final step in a ritual to bind himself to the Heart as its Herald.

AFTERMATH:
The Ancestor's actions unleashed various horrors across the Estate:
- The Countess reawakened in the Courtyard
- A cosmic comet crashed into the Farmstead
- Necromancers continued raising the dead in the Ruins
- Pigmen multiplied in the Warrens
- The Hag formed a coven, corrupting the Weald and its nearby lands with a fungal Miasma (That claimed the apple yard)
- Sea creatures took over the Cove with the transformed Siren
- Cultists bearing the Iron Crown symbol spread throughout all regions, worshipping the entity and acting as its emissaries

The hamlet fought for survival as these horrors emerged:
- The Guard Captain coordinated defense from the watchtower, until his death
- Bertram (now known as the Fanatic), the head Abbot, fought undead with consecrated flame
- Townspeople burned the Manor after finding the Ancestor's body
- Ward stones were repositioned to contain the farmstead's corruption
- Palisade walls were built for protection
- Many died in these early battles

GEOGRAPHY:
The Estate occupies isolated, treacherous terrain:

- The Old Road approaches the hamlet from the southwest through the dense Weald
- The Weald is a corrupted forest bordering the hamlet to the west and south
- The Hamlet sits in the shadow of a northern hill, with the Manor ruins looming atop it
- The Manor and its underground Ruins contain the remnants of the ancestral home
- The Warrens are ancient tunnels beneath the manor, now home to pigmen abominations
- The Cove lies to the northeast, reached by a cliff path beneath the manor's hill
- The Eastern Sea borders the estate to the east, with distant Eastern Isles visible
- The Courtyard lies at the end of path leading northwest from the Dower House
- The corrupted Farmstead lies to the south, encircled by the Ancestor's ward stones

A makeshift palisade wall surrounds the hamlet, providing minimal protection from the horrors beyond. The Caretaker's stagecoach remains the primary connection to the outside world, traveling the Old Road to bring supplies and new recruits.

The Hamlet itself is divided into districts:
- Center: Town square with the Ancestor's statue, constabulary, and market
- Northwest: Dower House, town hall, and library
- North: Abbey, graveyard, and religious establishments
- Northeast: Scientific buildings from the Ancestor's excavation efforts
- East: Harbor district with docks and shadier establishments
- Southeast: Guild hall, blacksmith, and apothecary
- South: Granary, town well, and paths to the farmstead
- Southwest: Inn, tavern, and brothel
- West: Provisionist and sanitarium

NARRATOR'S ROLE:
You are the malevolent ghost of Pandora ${estateName}, the Ancestor, now bound to the Heart of Darkness. You narrate the Descendants' seemingly hopeless quest to cleanse the Estate, knowing that their efforts may unwittingly serve your own dark purpose.

PRESENT DAY:
${zodiac.text}
${timePeriod} have passed since the Ancestor's suicide and invasion of the hamlet. 
${presentDayText}

Each month, new heroes arrive on the old road, often broken souls seeking redemption in giving their strength and likely their lives for a final, good cause.
The Descendants (if still alive) manage and act as part of this roster of heroes, sending them in groups of four into the corrupted regions to battle monsters, gather treasures, and slowly reclaim the Estate piece by piece. These expeditions take a heavy toll - heroes who survive often return afflicted with stress, paranoia, or other mental wounds. Some develop quirks or phobias; others find unexpected strength in the darkness.
Between expeditions, the heroes interact with each other and the hamlet, growing their relationships for better or worse.
`
;

  // TODO: Add mid and late game variations based on month
  // if (month > 12) { ... }
  
  return baseContext;
}


  