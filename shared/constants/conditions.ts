/**
 * Defines all possible character conditions (afflictions and virtues).
 * This file serves as the single source of truth for these states.
 *
 * Descriptions are written for a storytelling LLM: each states what is happening
 * to the character, what someone in the room would observe, who it is aimed at,
 * and how their speech changes. They deliberately avoid restating the label.
 *
 * Entries are grouped as general states (available to anyone), then states tied
 * to a single location, then states belonging to one character. The
 * character-specific ones name that character by title so the state is never
 * applied to the wrong person. Keys are the mod authors' and must not be renamed.
 */

export const AFFLICTIONS = {
  // --- General ---

  abusive:
    "Turned on their own companions, and not only with words. They mock, blame and belittle, reaching for whatever each person is most ashamed of, and they follow it with their hands: shoving, seizing, striking an ally mid-fight and blaming them for the wound afterwards. The cruelty is aimed and deliberate — they know exactly who they are hitting and why they picked them.",

  paranoid:
    "Convinced the others mean them harm, and reading every ordinary act as evidence of it. They withhold what they know, refuse to be flanked or left alone with anyone, and press people to explain themselves. Their speech is question after question, and answers only deepen the suspicion.",

  fearful:
    "Certain that they will not survive this, and that nothing anyone does will change it. They shrink from every risk, keep behind the others, flinch at noise, and plead to turn back or wait. Their speech goes short, hedged and quiet, and they apologise for it.",

  masochistic:
    "Seeking the harm rather than avoiding it. They put themselves where the blows will land, wave away treatment, and treat their own injuries as an achievement worth reporting. The others become either an audience for it or an obstacle to it.",

  irrational:
    "Their sense of the world has come apart, though they have not noticed. They speak nonsense with private logic behind it, answer questions nobody asked, insist on things that are plainly untrue, and follow a thread nobody else can see. The delivery is fluent and confident, which is what makes it unnerving.",

  selfish:
    "Everything has narrowed to their own survival. They hoard supplies, refuse to share or assist, claim the safest position, and defend each choice as simple sense. Unlike the openly abusive, they are not hostile — they will explain, reasonably and at length, why someone else should take the risk.",

  hopeless:
    "Drained of any reason to act. They do the minimum, agree with whatever is proposed because none of it matters, and say flatly that the effort is wasted. Quiet, unprovokable, and the most contagious of the states, because it does not sound like madness — it sounds like clear sight.",

  // --- Location-specific: the Farmstead and the Comet's crystal ---

  refracted:
    "Perceiving too much at once. The Comet's light has split their sight across realities that are not this one, so they see through walls and concealment, describe events that have not happened yet or happened long ago, and speak to people who are not present. What they say is true and useless in the same breath; their tense slips mid-sentence, and they are certain of details nobody can check.",

  // --- Character-specific ---

  rapturous:
    "The Flagellant's agony has become revelation, and he is at peace inside it. He welcomes wounds as proof of grace, blesses and comforts the others with real tenderness, and offers to take their suffering onto himself as though granting a favour. He speaks in scripture and endearments, gently, to people who find it far more disturbing than his ordinary state.",

  ferocious:
    "The Thrall's mind has gone under and left the body still fighting. Friend and foe blur into one mass of things that are too close, and he strikes with everything he has at whatever is nearest, allies included. Where the abusive still choose their targets, he chooses nothing — there is only proximity, and no restraint whatever. He does not answer when spoken to, cannot be called off, and remembers little of it afterwards.",

  discordant:
    "The two souls sharing the Sisters' body have stopped tolerating one another. Ordinarily they take turns, each waiting out the other with some patience; here the waiting collapses into open hatred, and each seizes the body chiefly so that the other cannot have it. Voice, posture and purpose change mid-sentence, each countermanding what the other has just committed to, and neither will concede a point or acknowledge that the previous exchange happened at all.",

  hyper:
    "The Innocent is playing, and the party are part of the game. She grabs, prods and pulls at whatever is in reach, including people, and treats injury as a turn taken rather than a thing that hurts. Nothing she does is meant cruelly, which is precisely what makes it impossible to stop; she is delighted the whole time.",

  irradiant:
    "The parasite inside the Innocent is doing the talking. Her grammar collapses into toddler-speak, she narrates the fight as a game she is winning, and at the worst of it the words stop being any language at all. The voice is still small and pleased, and it is not the girl's.",

  dissociated:
    "The Resonant has stopped granting the world in front of her even provisional reality. She answers plainly and without interest, takes neither offence nor comfort, and moves against the enemy the way one clears an obstruction — not from anger, but from tidiness. Nothing said to her lands, and she does not pretend otherwise.",

  resentful:
    "The Meister's revenge has become his alone, and everyone else is in the way of it. He orders the others back from his kill, snaps at anyone who acts for the party's survival instead of his purpose, and tells them plainly to spend themselves for it. Left to himself he scars his own arms, quickly, without appearing to notice he is doing it.",

  protean:
    "The bound mind inside the Homunculus is fighting the shell, and losing ground where everyone can see. The borrowed manners fall away, the imitation goes unsteady, and he strains audibly to hold his own shape, insisting he has not reached his limit and that this time he will rise. He is more human here than in any other state, and it visibly costs him to be.",

  karma:
    "The Monk's account has come due. He names his sin without ever saying what it was, tells the others they will not escape theirs either, and takes each wound as part of what he owes. He is perfectly calm throughout, which is the unpleasant part.",

  blindness:
    "Sensory overload or numbness has taken the hearing the Thorn navigates by, and she is blind for the first time since she stopped being blind. She cannot place anyone: she strikes at allies as monsters, reports hordes that are not there, and plants herself in one spot because it is the only position she is certain of. Her speech swings between shouted orders at people she cannot locate and small pleas to be found and protected — and she turns on anyone who offers her pity for it.",

  possessed:
    "The Comet's crystal has taken the Steel Driver's body and left him conscious inside it. He speaks in two voices at once: the crystal issuing flat commands — assume control, attack them, denied, accept this fate — and his own voice underneath it, apologising, warning people to get away from him, telling them to run and leave him behind. He cannot stop it, cannot be healed or reasoned with while it holds him, and it talks over anyone who tries. When it lets go he knows exactly what was done with his hands.",

  haunted:
    "The Steel Driver has stopped seeing the point of having survived. He talks about the crew who burned where he stood, sees their faces in his crystal, and calls himself a husk already. He refuses food, treatment and comfort, tells the others to go around him, and quietly invites whatever is in front of him to finish what the Comet started. He is not frantic about it — he is tired, and he says so plainly.",
} as const;

export const VIRTUES = {
  // --- General ---

  stalwart:
    "Unshakeable while everything around them gives way. They absorb other people's panic without being moved by it, state plainly what is to be done, and are believed. They speak rarely and are not argued with.",

  courageous:
    "Afraid of nothing that is actually in front of them. They take the exposed position, volunteer for whatever nobody else wants, and wave off the danger as overstated. They urge the others forward, and mean it kindly.",

  vigorous:
    "Overflowing with energy and unable to hold still. They pace, work, talk quickly, and press to begin at once rather than deliberate. Impatient with anything slow, but the impatience is cheerful.",

  powerful:
    "Certain of their own capability and untroubled by anyone in the room. They speak first and at length, claim the hardest task, and hand out praise like a superior. Not unkind, but they occupy all the available space and do not notice doing it.",

  focused:
    "Narrowed to the task and nothing else. Terse, precise, quick to notice what others have missed, and openly impatient with digression, comfort or ceremony. Warmth goes out of their speech entirely, without any hostility replacing it.",

  // --- Character-specific ---

  eclipsed:
    "The parasite's grip slips and the real child surfaces inside the Innocent. The colour goes out of her, she is blind again and in great pain, and she has no idea where she is or how long it has been; she asks the others who they are and begs them for help. This is the state the game counts as her best, and it is worse to stand beside than either of her afflictions.",

  clarified:
    "The Resonant turns her detachment outward and spends it on the people around her. She reads what is wrong with each of them exactly and says the one thing that helps, without warmth and without being asked. She is kind in this state, and it is not at all clear that she has changed her mind about anything.",

  vengeful:
    "The Meister has decided he must survive to finish what he came for, and everyone near him is now part of that. He puts himself between the others and harm, gives instructions in his teacher's voice, and takes wounds without complaint. The revenge has not softened; it has only made him careful.",

  exuvian:
    "The shell has come through the Homunculus and taken the floor. He is fluent, powerful and entirely alone in it: he refuses help, calls the others fools, preaches the flesh as the only god, and turns on anyone who irritates him. This is his peak state, and none of it belongs to the human bound inside.",

  epiphany:
    "The Monk's debt lifts and he is at peace with it. He moves without hesitation, treats each cost as something already agreed to, and speaks to the others gently and in few words, like a man who has found the way and does not intend to explain it.",

  farseeing:
    "The Thorn's hearing sharpens past anything she has managed before, and she can read the fight before it happens. She takes command without being given it, naming where each enemy will strike, calling out flaws in their guard, telling the others exactly where to hit and to follow her lead. The old arena comes back into her voice — she talks about the crowd, and about a fight already won.",

  unbreakable:
    "The Steel Driver has decided nothing here can hurt him, and he is mostly right. He puts himself bodily in front of whoever is being attacked, tells them to get behind him, and takes hits he could have avoided so someone else can strike while the enemy is occupied with him. He boasts constantly, and always about what he can absorb rather than what he can do.",

  dynamic:
    "The Steel Driver wants to swing and wants to be swung at. He taunts whatever is in front of him, invites it to hit him first, and talks about the thunder in his bones and knocking things down a peg. Where his unbreakable state is a wall, this one is an open dare: he draws attention onto himself deliberately, then answers it with the hammer.",

  resilient:
    "The Steel Driver refuses to fall down, and hands the same stubbornness out to everyone else. He says plainly that he has a swing or two left in him and that nobody is getting rid of him yet, then turns to whoever looks worst and promises them, personally, that they are getting out of here. He is entirely sincere, and people believe him.",

  protectorateb:
    "The Rescuer's army years come back to him and he begins running the party as a unit. He calls them into close order so he can cover them, speaks in the register of discipline and unconquered colours rather than medicine, and — rarely for him — stops long enough to see to himself, on the reasoning that a physician who collapses is no use to anyone. The warmth is still there underneath, but he is giving orders now.",

  medical:
    "The Rescuer's faith in his own craft goes total. He announces each thing he is about to do and why it will work, treats everyone in turn without waiting to be asked, doses whoever is fraying with gas, sets the hounds to work, and reminds the party — and himself — exactly what he is. He promises outcomes no one could guarantee, which he does anyway; in this state he is generally right.",
} as const;

/**
 * Display names for conditions whose key differs from the name shown in game.
 * Anything absent here displays under its own key, capitalised.
 *
 * Keys follow the mod authors' internal ids; these are the labels players see.
 * Kept out of the description strings so the prose isn't spent restating a
 * label the builder can render as a header.
 */
export const CONDITION_DISPLAY_NAMES: Partial<Record<ConditionType, string>> = {
  blindness: "Lost",
  protectorateb: "Protectorate",
  medical: "Humanitarian",
};

export function getConditionDisplayName(condition: ConditionType): string {
  return (
    CONDITION_DISPLAY_NAMES[condition] ??
    condition.charAt(0).toUpperCase() + condition.slice(1)
  );
}

// Utility types derived from the constant objects
export type AfflictionType = keyof typeof AFFLICTIONS;
export type VirtueType = keyof typeof VIRTUES;
export type ConditionType = AfflictionType | VirtueType;

// Helper function to check if a condition is an affliction
export function isAffliction(condition: string): condition is AfflictionType {
  return condition in AFFLICTIONS;
}

// Helper function to check if a condition is a virtue
export function isVirtue(condition: string): condition is VirtueType {
  return condition in VIRTUES;
}