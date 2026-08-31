/**
 * @file Disease/injury/curse identifiers and severities.
 *
 * Separate from conditions.ts (afflictions/virtues) because it's a different
 * shape of data: a hero can carry several diseases at once (CharacterStatus.diseases
 * is an array), where affliction/virtue is a single status.affliction slot.
 */

export const DISEASE_DESCRIPTIONS: Record<DiseaseType, string> = {
  // ==========================================
  // 1. VANILLA & BASE DLC
  // ==========================================
  black_plague: "Black, swollen lymph nodes throb with burning heat in the groin and armpits, while feverish cold sweats leave every muscle feeling hollow.",
  bad_humors: "A toxic, stagnant heaviness pools in the chest and stomach, making the entire body feel fragile and easily broken.",
  the_red_plague: "A scalding rash prickles across the torso, while the blood feels thin, hot, and unable to clot across even minor scrapes.",
  the_ague: "Violent waves of shivering cold alternate with drenching fevers, leaving the limbs heavy, aching, and slow to respond.",
  sky_taint: "A prickling, alien static tingles under the fingernails and teeth, making the mind feel raw and painfully sensitive to light.",
  syphilis: "Deep, gnawing bone aches flare through the skull and shins beneath dull, tender sores that refuse to close.",
  creeping_cough: "A raw, scraping tickle deep in the bronchial tubes triggers sudden chest-tightening spasms that leave the lungs starved of air.",
  lethargy: "An overwhelming, leaden exhaustion weighs down the shoulders and eyelids, making every step feel like wading through mud.",
  the_worries: "A cold, tightening tension twists the stomach into knots, keeping the pulse racing and the nerves on a hair-trigger.",
  hysterical_blindness: "A sudden, dark veil drops across their vision under strain, leaving their eyes straining against blurred shadows and blind spots.",
  the_runs: "Sharp, violent cramps knot the lower intestines in rolling waves of heat and exhausting nausea.",
  tetanus: "Stiffening tension clamps the jaw shut and pulls the muscles along the neck and back into tight, unyielding cords.",
  hemophilia: "A thin, watery warmth seeps endlessly from minor cuts, leaving veins feeling cold and drained with every heartbeat.",
  spotted_fever: "A burning, tender rash spreads across the skin alongside a dull, throbbing pressure behind the temples.",
  scurvy: "Deep, throbbing aches radiate through the joints and shins, while old scars feel hot and split open from the inside out.",
  tapeworm: "A hollow, gnawing pit in the gut demands constant sustenance, leaving the stomach churning with empty hunger pains.",
  vertigo: "A sickening tilt in the inner ear makes the ground feel as though it is rolling and dropping away beneath their feet.",
  vampiric_spirits: "A numbing, ghostly chill runs through the bloodstream, leaving the body sluggish and slow to ward off poisons or hexes.",
  ennui: "A dull, gray apathy settles behind the ribs, draining the spirit of any internal spark or will to endure.",
  wasting_sickness: "A deep, marrow-deep fatigue leaves the immune system fragile, cold, and open to every passing taint.",
  bulimic: "An acid burn scorches the back of the throat, accompanied by a heavy, rejecting nausea after every swallow of food.",
  spasm_of_the_entrails: "Sudden, sharp contractions seize the abdomen, making it painful to digest food or rest comfortably.",
  rabies: "A hot, surging agitation buzzes through the skull and jaws, flooding the muscles with frantic power while blurring peripheral vision.",
  the_fits: "Electric jolts of nerve energy fire through the extremities, twitching the fingers and quickening the pulse while shaking their aim.",
  grey_rot: "Flesh hardens into a thick, numb rind of deadened tissue, blunting external pain while deadening the precision of their strikes.",

  // Crimson Curse & Hive States
  disease_vampire_passive: "A faint, dry thirst prickles at the back of the mouth, accompanied by a subtle, restless quickening of the pulse.",
  disease_vampire_crave: "A burning, hollow hunger scorches the throat and veins, making the senses sharp and desperate for the taste of blood.",
  disease_vampire_wasting: "The body turns cold, brittle, and skeletal as life drains away, leaving the heart fluttering weakly behind the ribs.",
  disease_vampire_blood_lust: "Scalding power rushes through every capillary, flooding the muscles with euphoric frenzy and numbing all physical pain.",
  hive_vampire_passive: "A dull buzzing pulse thrums through the bloodstream, keeping the body warm and unnaturally resilient.",
  hive_vampire_crave: "A sharp, insectile prickling crawls beneath the skin, demanding fresh crimson to soothe the internal burning.",
  hive_vampire_wasting: "A hollow, dry numbness leeches into the joints, making the limbs feel frail and paper-thin.",
  hive_vampire_blood_lust: "A savage, searing surge floods the heart, drowning out fear and fatigue beneath a tide of predatory adrenaline.",

  // ==========================================
  // 2. EVOLVING DISEASES OVERHAUL (Mod 1381630368)
  // ==========================================
  // Stage 1 (Early Symptoms)
  bad_humours_1: "An irritable heat simmers in the chest, making small frustrations feel physically grating.",
  creeping_cough_1: "A dry, scratchy tickle sits high in the throat, catching on dry air and shallow breaths.",
  hemophilia_1: "A tender, bruised ache settles in the pit of the stomach, making heavy rations uncomfortable to digest.",
  the_runs_1: "A mild, bubbling discomfort churns in the lower abdomen, accompanied by occasional warm chills.",
  tetanus_1: "A stiff ache tightens the jaw and temples, leaving a persistent dull pressure at the base of the skull.",
  rabies_1: "A throbbing headache pulses behind the eyes, making sudden noises feel sharp and jarring.",
  syphilis_1: "A painless, firm sore sits silently on the skin, tingling with a faint, localized warmth.",
  bulimic_1: "A sudden, hollow pang of hunger strikes the stomach even shortly after eating.",
  lethargy_1: "A heavy, warm tiredness settles behind the eyelids and across the shoulders.",
  spotted_fever_1: "A dull, feverish pressure bands around the forehead, accompanied by warm flushes.",
  vertigo_1: "A faint lightness in the head causes the floor to feel slightly unsteady underfoot.",
  the_ague_1: "A mild, prickling sweat coats the brow while the shins and spine feel uncomfortably cold.",
  hysterical_blindness_1: "A gritty, dry irritation burns across the surface of the eyes, making torchlight sting.",
  scurvy_1: "A deep, wearisome ache settles into the calves and wrists after ordinary movement.",
  the_worries_1: "A cold knot of tension sits permanently behind the sternum, keeping the pulse elevated.",
  griping_guts_1: "Dull, twisting cramps pinch the intestines, leaving a sour taste in the mouth.",
  the_fits_1: "Occasional involuntary twitches flutter through the eyelids and fingers.",
  cysticercosis_1: "A faint, pale fatigue drains the stamina from the arms and legs.",
  the_red_plague_1: "A sudden wave of sour nausea rises in the throat, threatening to heave.",
  the_black_plague_1: "A tender, dull swelling forms under the armpit, aching when the arm moves.",
  epilepsy_1: "A strange, buzzing tension tightens the temples and makes the ears ring faintly.",
  dementia_1: "A momentary, floating dizziness blurs their sense of time and balance.",
  coeliac_1: "A bloated, aching pressure knots the stomach after consuming camp bread or grain.",
  red_weeping_1: "An intense, stinging heat burns beneath the eyelids, watering constantly.",
  madness_1: "A sudden, hyper-focused clarity sharpens the vision while leaving the chest tight with nervous energy.",
  scythe_blood_1: "A mild, tender swelling in the joints makes the hands feel stiff and slow to close.",
  possession_1: "A faint, alien resonance vibrates in the inner ear, accompanied by prickling skin.",
  haunt_1: "A cold, creeping draft seems to linger permanently against the back of the neck.",

  // Stage 2 (Intermediate Progressions)
  bad_humours_2: "A restless, prickly agitation boils in the blood, making the heart pound and breathing shallow.",
  creeping_cough_2: "A hot, raw burn scorches the lining of the throat, triggering sharp, hacking coughs.",
  hemophilia_2: "A pale, drained weakness saps the limbs, while small bumps bloom into large, deep bruises.",
  the_runs_2: "Watery, agonizing cramps violently purge the bowels, leaving the body dehydrated and cold.",
  tetanus_2: "Sudden, involuntary jerks lock the neck and back into tight, painful knots.",
  rabies_2: "A surging, hot agitation burns behind the eyes, making light feel harsh and the pulse race.",
  syphilis_2: "A warm, prickly rash spreads across the torso and palms, accompanied by dull joint aches.",
  bulimic_2: "Ravenous, hollow hunger cramps gnaw at the belly, accompanied by sour, burning nausea.",
  lethargy_2: "A thick, paralyzing fog blankets the mind and limbs, draining all urge to move or react.",
  spotted_fever_2: "Red, tender spots erupt across the limbs as fever heats the blood and clouds the thoughts.",
  vertigo_2: "A persistent, swaying disorientation tilts the visual field and upsets the inner ear.",
  the_ague_2: "Shuddering chills rattle the teeth before giving way to drenching, disorienting sweats.",
  hysterical_blindness_2: "Bloodshot, strained eyes struggle against spreading dark floaters and tunnel vision.",
  scurvy_2: "Skin becomes thin and purplish, weeping beads of blood at the friction of armor and straps.",
  the_worries_2: "The cold knot in the chest begins to loosen slightly, leaving behind a manageable, wary tension.",
  griping_guts_2: "Violent, recurring upheavals wrench the stomach empty, leaving the throat raw and burning.",
  the_fits_2: "Sharp, sudden tremors seize the hands and legs, causing weapons to wobble in the grip.",
  cysticercosis_2: "A sickening, wriggling fullness aches in the belly, accompanied by deep muscular tenderness.",
  the_red_plague_2: "An angry, inflamed rash burns across the chest, making clothing feel like sandpaper.",
  the_black_plague_2: "The swelling darkens into a foul, purplish mass of decaying tissue that throbs with sickly heat.",
  epilepsy_2: "Rhythmic, uncontrollable muscle twitches ripple across the face and shoulders.",
  dementia_2: "A thick mental fog causes familiar surroundings to feel momentarily strange and disorienting.",
  coeliac_2: "Severe intestinal inflammation drains energy, leaving the body malnourished and aching.",
  red_weeping_2: "Bloodshot capillaries burst in the sclera, leaking thin pink fluid down the cheeks.",
  madness_2: "A dizzying, electric rush floods the brain, making thoughts race faster than the body can follow.",
  scythe_blood_2: "Sickled blood cells clog the capillaries, causing sharp, localized stabbing pains in the limbs.",
  possession_2: "A persistent, murmuring vibration hums behind the eardrums, echoing strange cadences.",
  haunt_2: "Ice-cold chills ripple down the spine, leaving the skin covered in rigid gooseflesh.",

  // Stage 3 (Severe / Lethal Stages)
  bad_humours_3: "A raging, toxic fever inflames the nervous system, causing wild pulse spikes and erratic muscle jerks.",
  creeping_cough_3: "Violent, suffocating spasms rip through the chest, bringing up bloody phlegm and starving the lungs.",
  hemophilia_3: "The blood has lost all clotting ability, pooling beneath the skin in massive, agonizing hematomas.",
  tetanus_3: "Agonizing, full-body contractions lock the jaw shut and wrench the spine into a rigid, backward arch.",
  rabies_3: "A boiling, rabid fire burns through the brain and throat, inducing painful muscle spasms and frenzied agitation.",
  syphilis_3: "Tertiary decay eats at the nervous system, dulling balance and sending shooting pains through the skull.",
  bulimic_3: "An uncontrollable, acidic frenzy grips the gut, alternating between starving cramps and violent regurgitation.",
  lethargy_3: "A complete, leaden paralysis of the will leaves the body barely able to lift weapons or draw breath.",
  spotted_fever_3: "High, delirious fever scorches the brain while purpuric spots cover the failing skin.",
  vertigo_3: "A violent, spinning sickness flips the sense of balance completely upside down.",
  the_ague_3: "Severe malarial fevers exhaust the heart and spleen, leaving the body trembling and gasping for breath.",
  hysterical_blindness_3: "Total, suffocating blackness descends across the eyes during moments of high tension.",
  scurvy_3: "Teeth loosen in bleeding, blackened gums while old scars tear open across the limbs.",
  the_worries_3: "The acute panic has subsided into a quiet, manageable hum of cautious alertness.",
  griping_guts_3: "The entire digestive tract goes into violent, painful upheaval, unable to retain water or nourishment.",
  the_fits_3: "Continuous, violent twitching fires through the limbs, granting frantic speed at the cost of all control.",
  cysticercosis_3: "Parasitic cysts lodge in the brain and muscles, triggering agonizing neural misfires and seizures.",
  the_red_plague_3: "Flesh softens into weeping sores as internal hemorrhaging drains the body of vital warmth.",
  the_black_plague_3: "Gangrenous, black buboes putrefy on the body, flooding the bloodstream with lethal sepsis.",
  epilepsy_3: "Overwhelming neurological storms seize the entire body in violent, unconscious convulsions.",
  dementia_3: "A hollow, drifting detachment empties the skull, leaving the body moving through rooms without knowing how it arrived.",
  coeliac_3: "Complete digestive failure causes severe, agonizing abdominal cramps upon swallowing any food.",
  red_weeping_3: "Thick, dark blood weeps continuously from the tear ducts, stinging the eyes and blinding vision.",
  madness_3: "The mind fractures under a deafening internal cacophony, leaving the heart racing at terrifying speeds.",
  scythe_blood_3: "Widespread vascular blockages cause excruciating, bone-deep agony throughout the entire skeleton.",
  possession_3: "An alien, cold presence pulls the muscles like marionette strings, acting independently of the host's will.",
  haunt_3: "A freezing, suffocating weight presses down onto the chest, constricting the lungs and heart.",

  // Combat Physical Injuries
  concussion: "A sickening, heavy ache throbs through the skull, accompanied by nausea, ringing ears, and blurred light.",
  broken_shield_arm: "A sharp, grinding pain flares at the fracture with every jolt, sending hot pulses down into numb, unresponsive fingers.",
  torn_rotator: "A tearing, white-hot agony rips through the shoulder socket whenever the arm is raised to strike or block.",
  open_wound: "A deep, gaping tear burns with every movement, leaking warm blood and stinging fiercely in the cold air.",
  wrenched_knee: "A sickening pop in the joint leaves the knee swollen, unstable, and grinding bone-on-bone under weight.",
  puncture_wound: "A deep, throbbing ache penetrates the muscle tissue, hot to the touch and leaking dark blood.",
  deafened: "A muffled, deadened silence fills the ears, replaced by a high-pitched, disorienting ring.",
  tinnitus: "A relentless, piercing whistle hums inside the eardrum, grating on focus and drowning out quiet sounds.",

  // Occult Curses
  Iron_Maiden: "A sudden, crushing shock resonates through their own ribs and chest whenever a companion is struck, leaving behind phantom agony.",
  Life_Tapped: "A cold, draining sensation pulls at their open cuts, feeling their vital warmth being leeched away to nourish foes.",
  Deadwood_Gaze: "A prickly, creeping dread prickles at the periphery of their vision, feeling an unseen presence hovering just behind their shoulder.",
  Raine_Jinx: "A heavy, clumsy heaviness settles over the hands and feet, making weapons slip and reflexes misfire.",
  Outsiders_Vex: "Every physical impact reverberates directly into the skull like an iron hammer on an anvil.",
  Carnaces_Cradle: "A cold, suffocating shadow clings to the lungs, extinguishing the internal warmth of triumph.",
  Aberant_Spiral: "A cold, dizzying vertigo pulls at the stomach whenever an ally's blade swings wide and misses.",
  Drachan_Spite: "A sharp, venomous bile burns in the chest, slowly losing its bitter heat as the hex decays.",
  Decaying_Rudiment: "A rotting, dull ache saps the strength from the shoulders, gradually fading away with each passing hour.",
  Dry_Burden: "A leaden, unyielding weight drags at the heels and spine, slowly lightening as the curse dissolves.",
  Fragmented_Vision: "Vision splinters into jagged, disjointed planes that slowly knit back together as the hex weakens.",
  RCurse_2: "A faint, static tingle lingers over the skin, cool and rapidly dissipating into nothingness.",

  // Eldritch Evolution
  blood_taint_1: "An unnatural, oily warmth pulses through the veins, tingling with an unsettling, alien vigor.",
  minds_eye_1: "A sharp, expanding pressure pushes outward behind the forehead, buzzing with incomprehensible static.",
  Fractured_body_1: "A strange, hollow numbness leaves the flesh feeling unmoored from physical reality.",
  perfect_revelation: "A searing, cosmic fire blazes through the mind, flooding the limbs with transcendent power while tearing the nerves raw.",

  // ==========================================
  // 3. EAST TOWN / SUNWARD ISLES
  // ==========================================
  koshou: "A sharp, choking heat scorches the windpipe and lungs, making every inhalation feel like breathing ground ash.",
  kawasaki: "Blood vessels burn with widespread, tender inflammation, making every heartbeat ache in the chest and joints.",
  hashimoto: "A cold, sluggish heaviness settles into the thyroid, dragging down the metabolism and numbing the reflexes.",
  nihonnouen: "Inflammation swells the brain tissue, making the head ache fiercely and leaving the body overly sensitive to poisons.",
  beriberi: "Nerves in the legs tingle, go numb, and misfire, while fluid buildup leaves the ankles swollen and heavy.",
  smallpox: "Painful, fluid-filled pustules erupt across the body, burning with high, delirious fever.",
  dysentery: "Agonizing, bloody cramps tear through the bowels, leaving the abdomen hollow, dehydrated, and trembling.",
  tuberculosis: "A deep, consumptive rattle hollows out the lungs, coughing up dark blood and leaving the chest burning.",
  gangrene: "Flesh turns cold, black, and completely deadened to sensation, releasing a sickening sweet rot under the bandages.",
  hookworm: "Parasites leech the blood through the intestinal wall, leaving the veins cold, pale, and utterly exhausted.",
  measles: "A burning, blotchy rash covers the skin from scalp to heel alongside stinging, light-sensitive eyes.",
  typhoid: "Extreme, plateaued fever cooks the bloodstream, leaving the heart dangerously slow and the intestines ulcerated.",
  dipth: "A thick, leathery pseudomembrane coats the back of the throat, suffocating breaths and choking off air.",
  rheumatism: "Stiff, swollen joints grind painfully upon waking, shooting sharp aches through the fingers and knees.",
  lead: "A severe, agonizing colic clamps the abdomen in iron cramps while a metallic taste coats the tongue.",
  mono: "Lymph nodes in the neck swell into tender, painful stones while an overwhelming, bone-deep fatigue drags down the body.",
  myo: "The heart muscle throbs with tender, irregular beats, leaving the chest feeling tight, faint, and dangerously weak.",
  insane: "An electric, ungrounded mania races through the veins, keeping the pulse pounding and the thoughts spinning wildly.",

  // ==========================================
  // 4. DISEASY DOES IT (Mod 2342665064)
  // ==========================================
  influenza: "Aching joints, drenching sweats, and a raw, battered chest leave the entire frame shivering with exhaustion.",
  hypertension: "A tight, pounding pressure hammers inside the temples and behind the eyes with every surge of adrenaline.",
  living_death: "The pulse slows to a faint, creeping crawl, leaving the flesh cold to the touch and the limbs heavy as lead.",
  meningitis: "Excruciating stiffness locks the neck, making it agonizing to bend the chin toward the chest.",
  the_chills: "An unshakable, marrow-deep cold rattles the ribcage, sending involuntary shivers down the spine.",
  bone_death: "Deep, rotting necrosis eats at the joints from the inside, sending sickening grinding pains through the hips and knees.",
  migraine: "A blinding, one-sided pulse drills behind the eye, turning light and sound into sharp physical agony.",
  anorexia: "A shriveled, aching stomach rejects the thought of food, leaving the body running on empty reserves.",
  glassy_eye: "A dull, milky film blurs the pupil, diffusing light into hazy, distorted halos.",
  narcolepsy: "A heavy, irresistible wave of slumber suddenly drags the eyelids down, numbing the limbs mid-motion.",
  geist_fever: "A clammy, spectral chill runs beneath the skin, whispering fevered static through the auditory nerves.",
  bad_breath: "A sour, stagnant decay festers on the tongue, coating the mouth in a bitter, unwholesome film.",
  otitis: "A sharp, throbbing pressure builds behind the eardrum, leaking fluid and throwing off the sense of balance.",
  rickets: "Soft, aching bones bend and ache under the body's own weight, making the shins and ribs tender to pressure.",
  hepatitis: "A dull, swollen ache under the right ribs coincides with jaundiced, itchy skin and dark fatigue.",
  lupus: "The body's own defenses attack the joints and tissues, flaring into hot, unpredictable aches and facial rashes.",
  solar_urticaria: "Direct torchlight and sun cause the skin to prickle, swell, and burn with hot, angry hives.",
  acid_pustules: "Tender, caustic blisters throb on the skin, burning like liquid fire whenever pressurized or struck.",
  dementia: "A strange, drifting fog dulls the mind, leaving familiar surroundings feeling foreign and thoughts evaporating before they finish.",
  aids: "The immune system collapses into total fragility, leaving the body shivering and defenseless against the slightest infection.",
  sepsis: "Poisoned blood races through the heart, causing wild fever spikes, rapid shallow breaths, and systemic organ pain.",
  shadow_stigma: "A cold, dim veil clings to the retinas, making dark corridors and shadows appear dense and impenetrable.",
  panic_disorder: "A sudden, terrifying constriction crushes the chest, sending the pulse skyrocketing as if suffocating.",
  asthma: "Bronchial airways tighten into narrow straws, forcing wheezing, strained gasps to draw even a breath of air.",
  scoliosis: "An uneven, twisting ache pulls along the spine, pinching nerves and making armor sit awkwardly on the hips.",
  astigmatism: "Uneven cornea shape causes double vision and blurred edges, straining the eye muscles into a dull ache.",
  aether_curse: "A tingling, cosmic numbness numbs the fingertips, dulling the visceral impact of incoming hexes and strikes.",
  pyrohemia: "A scalding, internal heat boils within the bloodstream, making the veins feel as though they run with hot grease.",
  thyroiditis: "A tender, swollen mass in the throat aches with every swallow, throwing the heart rate into erratic rhythms.",

  // ==========================================
  // 5. MORE QUIRKS & DISEASES (Mod 1907320682)
  // ==========================================
  bonebreak_fever: "Severe, crippling aches strike deep in the joints and back, making every movement feel like snapping dry wood.",
  cholera: "Massive, violent intestinal purges rapidly drain the body of all fluids, cramping the muscles into rigid knots.",
  corpse_curse: "A rancid, graveyard chill settles into the marrow, making the skin gray, brittle, and slow to heal.",
  dropsy: "Heavy, waterlogged swelling pools in the legs and abdomen, leaving the skin taut, doughy, and breathless under strain.",
  ghoul_fever: "A gnawing, ravenous heat burns in the entrails, filling the mouth with excess saliva and craving raw meat.",
  heart_rot: "A sickening, hollow fluttering skips inside the chest, leaving the pulse weak, erratic, and fragile.",
  hiccups: "Sudden, involuntary spasms jerk the diaphragm, catching the breath with an annoying, repetitive jolt.",
  influx: "Painful, swollen inflammation congests the muscle tissues, making the body sluggish to dodge or weave.",
  pale_mans_plight: "A thin, anemic weakness leeches color from the face, leaving the veins sluggish and prone to opening.",
  mind_rot: "A dull, rotting lethargy numbs the higher senses, slowing reflexes and deadening motor coordination.",
  palsy: "Sudden, deadening weakness strikes a limb, leaving the muscles limp, trembling, and unresponsive.",
  paroxysm: "Abrupt, violent shivering fits convulse the torso, temporarily seizing the respiratory muscles.",
  pink_eye: "Thick, crusty discharge glues the eyelids shut, while the sclera burns with stinging, gritty irritation.",
  peckers_pox: "Irritating, tender sores flare in sensitive creases of skin, stinging sharply with friction.",
  pneumonia: "Lungs fill with wet, crackling fluid, turning every breath into a heavy, gasping struggle.",
  psychosis: "Nerves feel stripped raw and buzzing, leaving the mind overwhelmed by sensory static and racing pulses.",
  shrieking_sickness: "A grating, raw soreness tears the vocal cords and inner ear, vibrating painfully with loud noises.",
  the_common_cold: "A dull sinus pressure fills the forehead, accompanied by a runny nose, scratchy throat, and mild chills.",
  the_shakes: "Uncontrollable, fine tremors shake the hands and wrists, making precise manipulation impossible.",
  tongue_tie: "The tongue feels thick, swollen, and clumsy in the mouth, catching against the teeth during speech.",
  typhus: "A stuporous, burning delirium cooks the brain while dark red spots erupt across the failing torso.",
  whooping_cough: "Violent, barking coughing fits completely exhaust the lungs, ending in sharp, whistling gasps for air.",
  dancing_plague: "An uncontrollable, twitching restlessness fires through the calf and thigh muscles, forcing erratic steps.",
  migraines: "Throbbing, nauseating pressure hammers through one half of the skull, sensitive to every footstep and clash of steel.",

  // ==========================================
  // 6. WARHAMMER VERMINTIDE (Mod 2683922974)
  // ==========================================
  vmt_black_lung: "Heavy coal-dust and warp-ash cake the bronchial walls, coughing up black soot and suffocating the breath.",
  vmt_deep_scar: "A jagged, warp-tainted wound throbs with green heat, refusing to knit and seeping dark, uncoagulated bile.",
  vmt_deep_burn: "Chemical warpfire burns deep into the dermal layers, leaving the flesh raw, weeping, and vulnerable to rot.",
  vmt_dancing_eyes: "Nerves behind the retinas spasm uncontrollably, causing the gaze to dart erratically across the field.",
  vmt_acute_deafness: "Explosive concussion tears the eardrums, leaving a hollow, deadened vacuum filled with rushing air.",
  vmt_inflammable_pyrogenesis: "The skin and sweat feel volatile and chemically hot, prickling as if a single spark could ignite them.",
  warp_stone_addiction_exposed: "A toxic, green exhilaration buzzes in the bloodstream, speeding the heart while fraying the nerves.",
  vmt_chronic_fatigue: "Lingering warp-poisoning leaves a permanent, leaden exhaustion that rest and leisure fail to soothe.",
  vmt_tended_deafness: "A dull, muffled fuzziness deadens sound in the ears, though the acute ringing has finally passed.",
  warp_stone_addiction_radiating: "Raw, mutating warp-energy surges through the muscles like liquid lightning, thrilling the limbs with volatile power.",
  warp_stone_addiction_tended: "A regulated, steady hum of refined warp-energy keeps the pulse brisk and the senses sharpened.",

  // ==========================================
  // 7. KOALA'S CREATURE COLLECTION (Mod 2044162110)
  // ==========================================
  fishman_disease: "Skin turns cold, slick, and briny, while the lungs feel dry and gasping unless surrounded by salt air.",
  fishman_quirk: "Thick, rubbery scales and aquatic mucus coat the flesh, deadening external pain while quickening reflexes.",
  kcc_fungal_blood: "Fungal spores root deep inside the vascular network, blooming with acute energy against marked prey.",
  kcc_deep_blood: "Cold, abyssal pressure chills the veins, bringing a strange, soothing clarity only when severely wounded.",
  kcc_eldritch_blood: "An oily, alien ichor replaces natural blood, warding off physical rot while buzzing with cosmic tension.",
  kcc_swine_blood: "Thick, coarse beast-blood pumps heavily through the heart, swelling the muscles with brute vigor and hunger.",
  kcc_leprosy: "Nerve endings die off into numb, thickened patches of skin that weep clear fluid and deaden sensation.",
  kcc_tinnitus: "A shrill, metallic frequency rings perpetually in the ears, grating against quiet words of comfort.",

  // ==========================================
  // 8. CLASS MODS & SPECIAL PROGRESSIONS
  // ==========================================
  MC_PTSD_3: "Severe combat trauma triggers violent pulse surges, phantom gunfire ringing in the ears, and full-body tremors.",
  MC_PSYCHOSIS_3: "A total sensory overload floods the nervous system with phantom threats and frantic adrenaline spikes.",
  forsaken_disease: "The dry, hollow ache of marrow exposed to open air, where nerve-dead bone and shriveled sinew feel no hunger, only brittleness.",
  flesh_rot: "Grafted, necrotic flesh festers along surgical seams, leaking foul ichor and throbbing with foreign aches.",
  VV_quirk_2: "Vampiric corruption runs hot and predatory through the veins, quickening the step while demanding fresh plasma.",
  maledictor_disease: "A sickening, crawling heat pulses inside the arms and neck as parasitic worms visibly writhe beneath the vessel walls.",
  MC_PTSD_2: "Sudden adrenaline spikes tighten the throat and quicken the breath whenever blades clash unexpectedly.",
  MC_PSYCHOSIS_2: "A persistent, prickling static buzzes behind the temples, throwing focus and balance into disarray.",
  bloat_disease: "Toxic, pustulant bile builds up inside the viscera, converting incoming blights into feverish physical strength.",
  light_sensitive_disease: "The retinas burn with acute, stinging pain under bright torchlight, forcing the eyes to squint in agony.",
  VV_quirk_Rage: "A scalding, blind fury pumps through the heart, locking the teeth and flooding the muscles with berserk power.",
  VV_quirk_1: "A faint, predatory heat warms the blood, making the pulse sensitive to low light and moving shadows.",
  MC_PSYCHOSIS_1: "A restless, creeping tension flutters behind the ribs, making it difficult to find calm focus.",
  HARL_warts: "Tender, inflamed venereal sores sting and chafe with movement, aching with localized heat.",
  vampKraken_chompQuirk: "A bottomless, ravenous void churns in the stomach, demanding massive quantities of sustenance.",
  MC_PTSD_1: "A lingering nervousness keeps the neck muscles tight and the pulse jumping at sudden noises.",
  HARL_cooties: "An irritating, prickling itch crawls across the skin, distracting focus with persistent stinging.",
  vv_quirk_light: "Purified blood flows smoothly through the vessels, leaving a cool, steady calm behind the breastbone.",
  binge: "A heavy, bloated fullness stretches the stomach lining, adding sturdy bulk at the cost of quick footwork.",
  VV_quirk_0: "A deep, ancient scar tingles with phantom cold, pulling slightly against the underlying muscle.",

  // Thalassophobia (Abyssal Dream Progression)
  thalassophobia1: "A faint, oceanic pressure hums in the back of the skull like the distant sound of ocean waves.",
  thalassophobia2: "A cold, muffled silence wraps around the senses, as if standing deep underwater beneath crushing currents.",
  thalassophobia3: "A suffocating, deep-sea pressure constricts the lungs and ears, blurring reality with waking dreamscapes.",
  thalassophobia4: "A clear, steady depth settles in the mind, having mastered the crushing weight of the abyssal void.",
};

// --- Complete Disease, Injury & Curse Severity Mappings ---
export type DiseaseType =
  // ==========================================
  // 1. VANILLA & DLC BASE DISEASES
  // ==========================================
  | 'black_plague'
  | 'bad_humors'
  | 'the_red_plague'
  | 'the_ague'
  | 'sky_taint'
  | 'syphilis'
  | 'creeping_cough'
  | 'lethargy'
  | 'the_worries'
  | 'hysterical_blindness'
  | 'the_runs'
  | 'tetanus'
  | 'hemophilia'
  | 'spotted_fever'
  | 'scurvy'
  | 'tapeworm'
  | 'vertigo'
  | 'vampiric_spirits'
  | 'ennui'
  | 'wasting_sickness'
  | 'bulimic'
  | 'spasm_of_the_entrails'
  | 'rabies'
  | 'the_fits'
  | 'grey_rot'
  // Crimson Court / Hive Vampirism
  | 'disease_vampire_passive'
  | 'disease_vampire_crave'
  | 'disease_vampire_wasting'
  | 'disease_vampire_blood_lust'
  | 'hive_vampire_passive'
  | 'hive_vampire_crave'
  | 'hive_vampire_wasting'
  | 'hive_vampire_blood_lust'

  // ==========================================
  // 2. EVOLVING DISEASES OVERHAUL (Mod 1381630368)
  // ==========================================
  // Stage 1: Early Symptoms
  | 'bad_humours_1'
  | 'creeping_cough_1'
  | 'hemophilia_1'
  | 'the_runs_1'
  | 'tetanus_1'
  | 'rabies_1'
  | 'syphilis_1'
  | 'bulimic_1'
  | 'lethargy_1'
  | 'spotted_fever_1'
  | 'vertigo_1'
  | 'the_ague_1'
  | 'hysterical_blindness_1'
  | 'scurvy_1'
  | 'the_worries_1'
  | 'griping_guts_1'
  | 'the_fits_1'
  | 'cysticercosis_1'
  | 'the_red_plague_1'
  | 'the_black_plague_1'
  | 'epilepsy_1'
  | 'dementia_1'
  | 'coeliac_1'
  | 'red_weeping_1'
  | 'madness_1'
  | 'scythe_blood_1'
  | 'possession_1'
  | 'haunt_1'

  // Stage 2: Intermediate Progressions
  | 'bad_humours_2'
  | 'creeping_cough_2'
  | 'hemophilia_2'
  | 'the_runs_2'
  | 'tetanus_2'
  | 'rabies_2'
  | 'syphilis_2'
  | 'bulimic_2'
  | 'lethargy_2'
  | 'spotted_fever_2'
  | 'vertigo_2'
  | 'the_ague_2'
  | 'hysterical_blindness_2'
  | 'scurvy_2'
  | 'the_worries_2'
  | 'griping_guts_2'
  | 'the_fits_2'
  | 'cysticercosis_2'
  | 'the_red_plague_2'
  | 'the_black_plague_2'
  | 'epilepsy_2'
  | 'dementia_2'
  | 'coeliac_2'
  | 'red_weeping_2'
  | 'madness_2'
  | 'scythe_blood_2'
  | 'possession_2'
  | 'haunt_2'

  // Stage 3: Severe / Lethal Stages
  | 'bad_humours_3'
  | 'creeping_cough_3'
  | 'hemophilia_3'
  | 'tetanus_3'
  | 'rabies_3'
  | 'syphilis_3'
  | 'bulimic_3'
  | 'lethargy_3'
  | 'spotted_fever_3'
  | 'vertigo_3'
  | 'the_ague_3'
  | 'hysterical_blindness_3'
  | 'scurvy_3'
  | 'the_worries_3'
  | 'griping_guts_3'
  | 'the_fits_3'
  | 'cysticercosis_3'
  | 'the_red_plague_3'
  | 'the_black_plague_3'
  | 'epilepsy_3'
  | 'dementia_3'
  | 'coeliac_3'
  | 'red_weeping_3'
  | 'madness_3'
  | 'scythe_blood_3'
  | 'possession_3'
  | 'haunt_3'

  // Injuries (Combat Physical Trauma)
  | 'broken_shield_arm'
  | 'open_wound'
  | 'wrenched_knee'
  | 'tinnitus'
  | 'deafened'
  | 'torn_rotator'
  | 'concussion'
  | 'puncture_wound'

  // Curses & Decaying Occult Traits
  | 'Drachan_Spite'
  | 'RCurse_2'
  | 'Outsiders_Vex'
  | 'Dry_Burden'
  | 'Deadwood_Gaze'
  | 'Iron_Maiden'
  | 'Life_Tapped'
  | 'Raine_Jinx'
  | 'Carnaces_Cradle'
  | 'Decaying_Rudiment'
  | 'Aberant_Spiral'
  | 'Fragmented_Vision'

  // Eldritch Evolution
  | 'blood_taint_1'
  | 'minds_eye_1'
  | 'Fractured_body_1'
  | 'perfect_revelation'

  // ==========================================
  // 3. EAST TOWN / SUNWARD ISLES (Mods 1689234891 / 3022161159)
  // ==========================================
  | 'koshou'
  | 'kawasaki'
  | 'hashimoto'
  | 'nihonnouen'
  | 'beriberi'
  | 'smallpox'
  | 'dysentery'
  | 'tuberculosis'
  | 'gangrene'
  | 'hookworm'
  | 'measles'
  | 'typhoid'
  | 'dipth'
  | 'rheumatism'
  | 'lead'
  | 'mono'
  | 'myo'
  | 'insane'

  // ==========================================
  // 4. DISEASY DOES IT (Mod 2342665064)
  // ==========================================
  | 'influenza'
  | 'hypertension'
  | 'living_death'
  | 'meningitis'
  | 'the_chills'
  | 'bone_death'
  | 'migraine'
  | 'anorexia'
  | 'glassy_eye'
  | 'narcolepsy'
  | 'geist_fever'
  | 'bad_breath'
  | 'otitis'
  | 'rickets'
  | 'hepatitis'
  | 'lupus'
  | 'solar_urticaria'
  | 'acid_pustules'
  | 'dementia'
  | 'aids'
  | 'sepsis'
  | 'shadow_stigma'
  | 'panic_disorder'
  | 'asthma'
  | 'scoliosis'
  | 'astigmatism'
  | 'aether_curse'
  | 'pyrohemia'
  | 'thyroiditis'

  // ==========================================
  // 5. MORE QUIRKS & DISEASES (Mod 1907320682)
  // ==========================================
  | 'bonebreak_fever'
  | 'cholera'
  | 'corpse_curse'
  | 'dropsy'
  | 'ghoul_fever'
  | 'heart_rot'
  | 'hiccups'
  | 'influx'
  | 'pale_mans_plight'
  | 'mind_rot'
  | 'palsy'
  | 'paroxysm'
  | 'pink_eye'
  | 'peckers_pox'
  | 'pneumonia'
  | 'psychosis'
  | 'shrieking_sickness'
  | 'the_common_cold'
  | 'the_shakes'
  | 'tongue_tie'
  | 'typhus'
  | 'whooping_cough'
  | 'dancing_plague'
  | 'migraines'

  // ==========================================
  // 6. WARHAMMER VERMINTIDE (Mod 2683922974)
  // ==========================================
  | 'warp_stone_addiction_exposed'
  | 'warp_stone_addiction_radiating'
  | 'warp_stone_addiction_tended'
  | 'vmt_black_lung'
  | 'vmt_deep_burn'
  | 'vmt_chronic_fatigue'
  | 'vmt_acute_deafness'
  | 'vmt_tended_deafness'
  | 'vmt_inflammable_pyrogenesis'
  | 'vmt_dancing_eyes'
  | 'vmt_deep_scar'

  // ==========================================
  // 7. KOALA'S CREATURE COLLECTION (Mod 2044162110)
  // ==========================================
  | 'fishman_disease'
  | 'fishman_quirk'
  | 'kcc_fungal_blood'
  | 'kcc_deep_blood'
  | 'kcc_eldritch_blood'
  | 'kcc_swine_blood'
  | 'kcc_leprosy'
  | 'kcc_tinnitus'

  // ==========================================
  // 8. CLASS MOD CONDITIONS & THALASSOPHOBIA
  // ==========================================
  | 'HARL_cooties'
  | 'HARL_warts'
  | 'VV_quirk_0'
  | 'vv_quirk_light'
  | 'VV_quirk_1'
  | 'VV_quirk_2'
  | 'VV_quirk_Rage'
  | 'flesh_rot'
  | 'bloat_disease'
  | 'binge'
  | 'forsaken_disease'
  | 'maledictor_disease'
  | 'vampKraken_chompQuirk'
  | 'light_sensitive_disease'
  | 'MC_PTSD_1'
  | 'MC_PTSD_2'
  | 'MC_PTSD_3'
  | 'MC_PSYCHOSIS_1'
  | 'MC_PSYCHOSIS_2'
  | 'MC_PSYCHOSIS_3'
  | 'thalassophobia1'
  | 'thalassophobia2'
  | 'thalassophobia3'
  | 'thalassophobia4';

export const DISEASE_SEVERITY: Record<DiseaseType, number> = {
  // ==========================================
  // 1. VANILLA & BASE DLC (0-100)
  // ==========================================
  black_plague: 85,          // -75% Blight/Disease, -10% HP, -5 SPD
  bad_humors: 75,            // -20% Max HP
  the_red_plague: 75,        // -75% Bleed, -10% HP, -5% Crit
  the_ague: 70,              // -10% DMG, -3 SPD, -10% HP
  sky_taint: 65,             // +20% Stress, -20% Bleed/Blight
  syphilis: 65,              // -5 ACC, -10% DMG, -10% HP
  creeping_cough: 60,        // -20% DMG
  lethargy: 60,              // -4 SPD
  the_worries: 55,           // +30% Stress
  hysterical_blindness: 55,  // -20 ACC if Stress > 70
  the_runs: 50,              // -20 Dodge, -10% HP
  tetanus: 45,               // -5 ACC, -5% Crit
  hemophilia: 40,            // -50% Bleed Resist
  spotted_fever: 40,         // -50% Blight Resist
  scurvy: 40,                // -40% Bleed/Move Resist
  tapeworm: 35,              // +100% Food, curio theft
  vertigo: 30,               // -50% Move Resist
  vampiric_spirits: 25,      // -50% Debuff Resist
  ennui: 25,                 // -25% Virtue Chance
  wasting_sickness: 20,      // -50% Disease Resist
  bulimic: 15,               // -20% Camping Heal
  spasm_of_the_entrails: 15, // -20% Camping Heal
  rabies: 20,                // +15% DMG, -10 ACC (Intentional damage buff)
  the_fits: 15,              // +3 SPD, -5 ACC, -5% Crit
  grey_rot: 10,              // +20% HP, -10 ACC, -10% DMG (God-tier on tanks)

  // Crimson Curse & Hive States
  disease_vampire_wasting: 80,
  hive_vampire_wasting: 80,
  disease_vampire_crave: 50,
  hive_vampire_crave: 50,
  disease_vampire_passive: 30,
  hive_vampire_passive: 30,
  disease_vampire_blood_lust: 15, // Massive combat buffs
  hive_vampire_blood_lust: 15,

  // ==========================================
  // 2. EVOLVING DISEASES OVERHAUL (Mod 1381630368)
  // ==========================================
  // Stage 1 (Mild Symptoms)
  the_black_plague_1: 40,
  the_red_plague_1: 35,
  the_ague_1: 35,
  cysticercosis_1: 35,
  scythe_blood_1: 35,
  bad_humours_1: 30,
  hemophilia_1: 30,
  the_runs_1: 30,
  tetanus_1: 30,
  rabies_1: 30,
  lethargy_1: 30,
  spotted_fever_1: 30,
  vertigo_1: 30,
  hysterical_blindness_1: 30,
  scurvy_1: 30,
  griping_guts_1: 30,
  epilepsy_1: 30,
  dementia_1: 30,
  coeliac_1: 30,
  red_weeping_1: 30,
  creeping_cough_1: 25,
  the_fits_1: 25,
  madness_1: 25,
  possession_1: 25,
  haunt_1: 25,
  syphilis_1: 20,
  bulimic_1: 20,
  the_worries_1: 55, // Base worries stress hit

  // Stage 2 (Intermediate)
  the_black_plague_2: 75,
  bad_humours_2: 55,
  hemophilia_2: 55,
  the_runs_2: 55,
  tetanus_2: 55,
  lethargy_2: 55,
  the_ague_2: 55,
  cysticercosis_2: 55,
  the_red_plague_2: 55,
  scythe_blood_2: 55,
  spotted_fever_2: 50,
  hysterical_blindness_2: 50,
  scurvy_2: 50,
  griping_guts_2: 50,
  epilepsy_2: 50,
  coeliac_2: 50,
  red_weeping_2: 50,
  creeping_cough_2: 45,
  rabies_2: 45,
  syphilis_2: 45,
  vertigo_2: 45,
  dementia_2: 45,
  madness_2: 45,
  possession_2: 45,
  haunt_2: 45,
  the_fits_2: 40,
  bulimic_2: 35,
  the_worries_2: 35, // Improving stage

  // Stage 3 (Severe / Lethal Evolution)
  the_black_plague_3: 95,     // Fatal, -100% Deathblow/Blight Resist
  tetanus_3: 90,              // Fatal if untreated
  cysticercosis_3: 90,        // Fatal if untreated
  rabies_3: 85,               // Fatal, attacks allies
  scythe_blood_3: 85,         // -100% Bleed/Disease Resist, -15% HP
  syphilis_3: 80,             // -20% All Resists, -10 ACC, -20 Dodge
  bad_humours_3: 75,          // Massive irritability, turn loss
  hemophilia_3: 75,           // Severe Bleed vulnerability & damage
  lethargy_3: 75,             // -8 SPD, -8 Crit
  the_ague_3: 75,             // -20 SPD, -50% Disease/Debuff Resist
  the_red_plague_3: 75,       // -50% Bleed Resist + severe strain
  spotted_fever_3: 70,        // -10% HP, -25% multiple resists
  scurvy_3: 70,               // -40% Healing Received, -10 ACC/Dodge
  griping_guts_3: 70,         // -20% Max HP, camping heal loss
  epilepsy_3: 70,             // Seizures, ignores commands
  hysterical_blindness_3: 70, // -20 ACC, +20% Stress
  madness_3: 70,              // +50% Stress Damage
  creeping_cough_3: 65,       // -10% DMG, -50% Debuff, turn skips
  red_weeping_3: 65,          // -20 ACC, self-harm
  vertigo_3: 60,              // -10 ACC, -10 Dodge, -50% Move
  dementia_3: 60,             // Memory loss, forced moves, self-harm
  coeliac_3: 60,              // Refuses camp eating, starvation
  haunt_3: 55,                // Paranoid marking, turn disruptions
  bulimic_3: 40,              // Compulsive eating & curio disruption
  the_fits_3: 30,             // +5 SPD, +10 Crit, but -20 ACC
  possession_3: 25,           // Double-edged supernatural possession
  the_worries_3: 20,          // Reduced to mild "Uneasy" state

  // Combat Physical Injuries
  concussion: 65,
  broken_shield_arm: 60,
  torn_rotator: 55,
  open_wound: 55,
  wrenched_knee: 50,
  puncture_wound: 50,
  deafened: 45,
  tinnitus: 35,

  // Occult Curses
  Iron_Maiden: 75,            // Feels all damage taken by allies
  Life_Tapped: 75,            // Bleeding wounds heal enemies
  Deadwood_Gaze: 70,          // Severe paranoia ("It" hallucinations)
  Raine_Jinx: 65,             // -10% All skills and all resists
  Outsiders_Vex: 60,          // Heavy stress on hits
  Carnaces_Cradle: 60,        // Snuffs light on victory
  Aberant_Spiral: 55,         // Panic on ally misses
  Drachan_Spite: 50,
  Decaying_Rudiment: 50,
  Dry_Burden: 45,
  Fragmented_Vision: 45,
  RCurse_2: 20,               // Residual curse (fading away)

  // Eldritch Evolution
  blood_taint_1: 40,
  minds_eye_1: 40,
  Fractured_body_1: 40,
  perfect_revelation: 45,     // +200% Stress, but god-tier combat bonuses

  // ==========================================
  // 3. EAST TOWN / SUNWARD ISLES
  // ==========================================
  tuberculosis: 85,           // Phthisis: -35% DMG, -15 Dodge, eats 0 food
  typhoid: 85,                // Enteric fever: -50% Deathblow Resist, -10 Dodge
  myo: 85,                    // Myocarditis: -50% Deathblow Resist, -20% Stun
  smallpox: 80,               // -25% Max HP, -10% PROT
  gangrene: 80,               // -20% Max HP, cannot be healed
  hookworm: 80,               // -75% Bleed Resist, -20% Max HP
  lead: 80,                   // Dry Bellyache: -15 ACC, -20% HP, -15% Virtue
  dipth: 75,                  // Diphtheria: -35% DMG, +10% Stress
  dysentery: 65,              // -3 SPD, eats 2x food, heal penalty
  kawasaki: 60,               // Kawasaki: Extra DMG taken, -20% Debuff skill
  nihonnouen: 60,             // Japanese Encephalitis: extra Bleed/Blight dmg
  measles: 60,                // -20% Max HP, stress triggers
  mono: 55,                   // Glandular fever: +30% Stress, -40% Disease
  koshou: 50,                 // Pepper Sickness: -HP, +30% Stress
  rheumatism: 50,             // -15% Crit
  beriberi: 45,               // -3 SPD, random turn actions, +10% PROT
  insane: 45,                 // Mania: +20% Stress
  hashimoto: 40,              // Hashimoto: -3 SPD, heal penalties

  // ==========================================
  // 4. DISEASY DOES IT (Mod 2342665064)
  // ==========================================
  aids: 90,                   // Immune Suppression: -75% Disease, all resists hit
  sepsis: 85,                 // Septicemia: -5 Crit, septic shock
  bone_death: 80,             // Bone Rot: -5 SPD, -20 Dodge
  living_death: 75,           // -15% HP, -4 SPD
  influenza: 70,              // The Flu: -20% DMG, -20% Stun/Debuff
  meningitis: 70,             // -10% HP, daze and confusion
  narcolepsy: 65,             // Random turn sleep/skips
  rickets: 65,                // -10% HP, -10 PROT, -3 SPD
  hypertension: 60,           // Hypertensive crisis danger
  anorexia: 60,               // Starvation & fasting
  geist_fever: 60,            // Whispering Fever: -10% DMG, +20% Stress
  asthma: 60,                 // Asthma attacks: DMG/Crit penalties
  otitis: 55,                 // Ear Infection: -20 Dodge, -20% Stun/Move
  lupus: 55,                  // Lupus flare-ups
  pyrohemia: 55,              // Self-burns / agony
  thyroiditis: 55,            // -10% HP, -5 ACC, chorea
  panic_disorder: 55,         // Surprise & horror triggers
  glassy_eye: 50,             // -10 ACC, +10% Stress
  hepatitis: 50,              // -40% Blight/Debuff resist
  scoliosis: 50,              // -40% Trap, SPD/Dodge burdens
  astigmatism: 50,            // Inconsistent accuracy/damage
  the_chills: 45,             // The Shivers: -2 SPD, -10 Dodge
  solar_urticaria: 45,        // Sun Allergy: Light debuffs
  acid_pustules: 50,          // Acrid Boils: Splash damage
  dementia: 35,               // Dementia: Forgetfulness & erratic act-outs
  aether_curse: 40,           // -20% Stress, -20% Skill chance
  shadow_stigma: 40,          // -10 Scouting
  migraine: 40,               // Headaches
  bad_breath: 20,             // Halitosis: minor social penalty

  // ==========================================
  // 5. MORE QUIRKS & DISEASES (Mod 1907320682)
  // ==========================================
  corpse_curse: 85,           // -20% HP, -20% Disease, Deathblow debuff
  heart_rot: 85,              // Severe Deathblow & Bleed debuff
  cholera: 75,                // Severe Max HP debuff
  bonebreak_fever: 65,        // -10% DMG, -4 SPD
  pink_eye: 60,               // -20 ACC
  psychosis: 60,              // Stress resist & Virtue debuff
  the_shakes: 60,             // -10 Crit, random targeting
  typhus: 60,                 // Healing received penalty, -2 SPD
  dropsy: 55,                 // +DMG taken, -15% Bleed/Blight
  influx: 50,                 // -20 Dodge
  pale_mans_plight: 50,       // -50% Disease, -25% Bleed
  mind_rot: 50,               // -3 SPD, -10 Dodge
  pneumonia: 50,              // -10% HP
  whooping_cough: 50,         // -10 ACC, -2 SPD
  peckers_pox: 45,            // -7 Crit, +Crit taken
  shrieking_sickness: 45,     // -Dodge, -Disease resist
  dancing_plague: 45,         // -Move resist, involuntary dance
  palsy: 40,                  // Stun resist drop
  migraines: 40,              // -10 Dodge, stress vulnerability
  ghoul_fever: 35,            // +DMG, -Stress resist, extra food
  paroxysm: 30,               // -40% Disease resist
  hiccups: 25,                // -5 ACC
  the_common_cold: 20,        // Minor disease resist drop
  tongue_tie: 20,             // Minor bark restriction

  // ==========================================
  // 6. WARHAMMER VERMINTIDE (Mod 2683922974)
  // ==========================================
  vmt_black_lung: 75,         // Black Lung: -SPD, -Crit, -DMG
  vmt_deep_scar: 70,          // -HP, -Deathblow, uncurable bleed/blight
  vmt_deep_burn: 60,          // -Bleed, -Blight, -Disease
  vmt_dancing_eyes: 60,       // Involuntary random targeting
  vmt_acute_deafness: 50,     // -20% Move/Stun resist, stress heal debuff
  vmt_inflammable_pyrogenesis: 45, // +DMG received, +Torch
  warp_stone_addiction_exposed: 35, // +SPD, +DMG, +15% Stress
  vmt_chronic_fatigue: 35,    // Hamlet stress treatment penalty
  vmt_tended_deafness: 30,    // -10% Move/Stun resist
  warp_stone_addiction_radiating: 25, // Powerful warp buff (+3 SPD, +20% DMG)
  warp_stone_addiction_tended: 20,    // Stable warp mutation

  // ==========================================
  // 7. KOALA'S CREATURE COLLECTION (Mod 2044162110)
  // ==========================================
  fishman_disease: 50,        // Pelagic Plague: -HP, +Stress, +SPD/DMG
  kcc_leprosy: 50,            // -Bleed/Blight resist, +DMG taken, +Stress
  fishman_quirk: 40,          // Pelagic Embrace: Advanced mutation
  kcc_fungal_blood: 35,       // +Stats vs Marked, -Stats vs Unmarked
  kcc_deep_blood: 30,         // Stress buffs when below 50% HP
  kcc_tinnitus: 30,           // Stress heal received penalty
  kcc_eldritch_blood: 25,     // +Resists, +Stress
  kcc_swine_blood: 25,        // +HP, +Disease resist, +Food

  // ==========================================
  // 8. CLASS MODS & SPECIAL PROGRESSIONS
  // ==========================================
  MC_PTSD_3: 75,              // Severe Combat Trauma Stage 3
  MC_PSYCHOSIS_3: 80,         // Psychotic breakdown
  forsaken_disease: 65,       // Decomposition: Starvation stress
  flesh_rot: 60,              // Flesh Curse: Flesh Golem corruption
  VV_quirk_2: 60,             // Darkspawn (Voivode vampire progression)
  maledictor_disease: 55,     // Writhevein: Food and healing penalties
  MC_PTSD_2: 55,              // Combat Trauma Stage 2
  MC_PSYCHOSIS_2: 60,         // Psychosis Stage 2
  bloat_disease: 45,          // Divine Fever: Blight interaction
  light_sensitive_disease: 45,// Photophobia: -DMG in bright light
  VV_quirk_Rage: 45,          // Darkspawn Frenzy (High berserk stats)
  VV_quirk_1: 40,             // Darkbrood Stage 1
  MC_PSYCHOSIS_1: 40,         // Psychosis Stage 1
  HARL_warts: 35,             // Genital Warts: -SPD, -Heal
  vampKraken_chompQuirk: 35,  // Kraekan Hunger: High food consumption
  MC_PTSD_1: 35,              // Combat Trauma Stage 1
  HARL_cooties: 30,           // Cooties: -SPD, -Crit, -Debuff
  vv_quirk_light: 30,         // Darkbrood Cleansing
  binge: 25,                  // Overfeeding: +5 Max HP, -1 SPD
  VV_quirk_0: 20,             // Cursed Scar

  // Thalassophobia (Abyssal Dream Progression - tuned mild as requested)
  thalassophobia3: 50,        // Awakening
  thalassophobia2: 35,        // Silence
  thalassophobia4: 30,        // Clarity (Willpower proven)
  thalassophobia1: 20,        // Dormancy
};

/**
 * Canonical in-game display names for all Diseases, Stages, Injuries, and Curses.
 * Fully resolved from game files and localization string tables.
 */
export const DISEASE_DISPLAY_NAMES: Record<DiseaseType, string> = {
  // ==========================================
  // 1. VANILLA & BASE DLC
  // ==========================================
  black_plague: "Black Plague",
  bad_humors: "Bad Humours",
  the_red_plague: "The Red Plague",
  the_ague: "The Ague",
  sky_taint: "Sky Taint",
  syphilis: "Syphilis",
  creeping_cough: "Creeping Cough",
  lethargy: "Lethargy",
  the_worries: "The Worries",
  hysterical_blindness: "Hysterical Blindness",
  the_runs: "The Runs",
  tetanus: "Tetanus",
  hemophilia: "Hemophilia",
  spotted_fever: "Spotted Fever",
  scurvy: "Scurvy",
  tapeworm: "Tapeworm",
  vertigo: "Vertigo",
  vampiric_spirits: "Vampiric Spirits",
  ennui: "Ennui",
  wasting_sickness: "Wasting Sickness",
  bulimic: "Bulimic",
  spasm_of_the_entrails: "Spasm of the Entrails",
  rabies: "Rabies",
  the_fits: "The Fits",
  grey_rot: "Grey Rot",

  // Crimson Curse & Hive States
  disease_vampire_passive: "The Crimson Curse (Passive)",
  disease_vampire_crave: "The Crimson Curse (Craving)",
  disease_vampire_wasting: "The Crimson Curse (Wasting)",
  disease_vampire_blood_lust: "The Crimson Curse (Bloodlust)",
  hive_vampire_passive: "Crimson Hive (Sated)",
  hive_vampire_crave: "Crimson Hive (Craving)",
  hive_vampire_wasting: "Crimson Hive (Wasting)",
  hive_vampire_blood_lust: "Crimson Hive (Bloodlust)",

  // ==========================================
  // 2. EVOLVING DISEASES OVERHAUL (Mod 1381630368)
  // ==========================================
  // Stage 1 (Early Symptoms)
  bad_humours_1: "Unusual Temper",
  creeping_cough_1: "Roughened Voice",
  hemophilia_1: "Stomach Pain",
  the_runs_1: "Stomach Pain",
  tetanus_1: "Headache",
  rabies_1: "Headache",
  syphilis_1: "Chancre",
  bulimic_1: "Ardent Hunger",
  lethargy_1: "Unusual Temper",
  spotted_fever_1: "Headache",
  vertigo_1: "Headache",
  the_ague_1: "Fever",
  hysterical_blindness_1: "Eye Irritation",
  scurvy_1: "Tiredness",
  the_worries_1: "The Worries",
  griping_guts_1: "Stomach Pain",
  the_fits_1: "Spasms",
  cysticercosis_1: "Anemia",
  the_red_plague_1: "Vomiting",
  the_black_plague_1: "Minor Swelling",
  epilepsy_1: "Headache",
  dementia_1: "Headache",
  coeliac_1: "Headache",
  red_weeping_1: "Eye Irritation",
  madness_1: "Inclination of Fate",
  scythe_blood_1: "Minor Swelling",
  possession_1: "Inclination of Fate",
  haunt_1: "Inclination of Fate",

  // Stage 2 (Intermediate)
  bad_humours_2: "Prone Hysteria",
  creeping_cough_2: "Burning Throat",
  hemophilia_2: "Anemia",
  the_runs_2: "The Runs",
  tetanus_2: "Seizures",
  rabies_2: "Ceaseless Bloodshot",
  syphilis_2: "Diffuse Rash",
  bulimic_2: "Ravenous Craving",
  lethargy_2: "Ennui",
  spotted_fever_2: "Inflamed Rash",
  vertigo_2: "Disorientation",
  the_ague_2: "Malaria",
  hysterical_blindness_2: "Ceaseless Bloodshot",
  scurvy_2: "Bleeding Skin",
  the_worries_2: "Fearful",
  griping_guts_2: "Vomiting",
  the_fits_2: "Seizures",
  cysticercosis_2: "Tapeworm Infection",
  the_red_plague_2: "Inflamed Rash",
  the_black_plague_2: "Dying Flesh",
  epilepsy_2: "Seizures",
  dementia_2: "Disorientation",
  coeliac_2: "Anemia",
  red_weeping_2: "Ceaseless Bloodshot",
  madness_2: "Dawning Realisation",
  scythe_blood_2: "Anemia",
  possession_2: "Hearing Voices",
  haunt_2: "Hearing Voices",

  // Stage 3 (Severe / Lethal)
  bad_humours_3: "Bad Humours",
  creeping_cough_3: "Creeping Cough",
  hemophilia_3: "Hemophilia",
  tetanus_3: "Tetanus",
  rabies_3: "Rabies",
  syphilis_3: "Syphilis",
  bulimic_3: "Bulimic",
  lethargy_3: "Lethargy",
  spotted_fever_3: "Spotted Fever",
  vertigo_3: "Vertigo",
  the_ague_3: "The Ague",
  hysterical_blindness_3: "Hysterical Blindness",
  scurvy_3: "Scurvy",
  the_worries_3: "Uneasy",
  griping_guts_3: "Griping in the Guts",
  the_fits_3: "The Fits",
  cysticercosis_3: "Cysticercosis",
  the_red_plague_3: "The Red Plague",
  the_black_plague_3: "The Black Plague",
  epilepsy_3: "Epilepsy",
  dementia_3: "Dementia",
  coeliac_3: "Coeliac Defect",
  red_weeping_3: "Red Weeping",
  madness_3: "Madness",
  scythe_blood_3: "Scythe-cell Blood",
  possession_3: "Possession",
  haunt_3: "Haunted",

  // Combat Physical Injuries
  broken_shield_arm: "Crushed Shield Arm",
  open_wound: "Open Wounds",
  wrenched_knee: "Wrenched Knee",
  tinnitus: "Tinnitus",
  deafened: "Deafened",
  torn_rotator: "Torn Rotator",
  concussion: "Concussion",
  puncture_wound: "Puncture Wound",

  // Occult Curses
  Drachan_Spite: "Dratchan Spite",
  RCurse_2: "Residual Curse",
  Outsiders_Vex: "Outsider's Vex",
  Dry_Burden: "Dry Burden",
  Deadwood_Gaze: "Deadwood Gaze",
  Iron_Maiden: "Iron Maiden",
  Life_Tapped: "Life Tapped",
  Raine_Jinx: "Raine Jinx",
  Carnaces_Cradle: "Carnaces Cradle",
  Decaying_Rudiment: "Decaying Rudiment",
  Aberant_Spiral: "Aberrant Spiral",
  Fragmented_Vision: "Fragmented Vision",

  // Eldritch Evolution
  blood_taint_1: "Blood Taint",
  minds_eye_1: "Mind's Eye",
  Fractured_body_1: "Fractured Body",
  perfect_revelation: "Perfect Revelation",

  // ==========================================
  // 3. EAST TOWN / SUNWARD ISLES
  // ==========================================
  koshou: "Koshou",
  kawasaki: "Kawasaki's Disease",
  hashimoto: "Hashimoto's Disease",
  nihonnouen: "Nihonnouen",
  beriberi: "Beriberi",
  smallpox: "Smallpox",
  dysentery: "Dysentery",
  tuberculosis: "Phthisis",
  gangrene: "Gangrene",
  hookworm: "Hookworm",
  measles: "Measles",
  typhoid: "Enteric Fever",
  dipth: "Diphtheria",
  rheumatism: "Rheumatism",
  lead: "Dry Bellyache",
  mono: "Glandular Fever",
  myo: "Myocarditis",
  insane: "Mania",

  // ==========================================
  // 4. DISEASY DOES IT (Mod 2342665064)
  // ==========================================
  influenza: "The Flu",
  hypertension: "Hypertension",
  living_death: "Living Death",
  meningitis: "Meningitis",
  the_chills: "The Shivers",
  bone_death: "Bone Rot",
  migraine: "Migraines",
  anorexia: "Anorexic",
  glassy_eye: "Glassy Eye",
  narcolepsy: "Narcolepsy",
  geist_fever: "Whispering Fever",
  bad_breath: "Halitosis",
  otitis: "Ear Infection",
  rickets: "Rickets",
  hepatitis: "Hepatitis",
  lupus: "Lupus",
  solar_urticaria: "Sun Allergy",
  acid_pustules: "Acrid Boils",
  dementia: "Dementia",
  aids: "Immune Suppression",
  sepsis: "Septicemia",
  shadow_stigma: "Shadow Stigma",
  panic_disorder: "Panic Attacks",
  asthma: "Asthma",
  scoliosis: "Scoliosis",
  astigmatism: "Astigmatism",
  aether_curse: "Aether Curse",
  pyrohemia: "Pyrohemia",
  thyroiditis: "Thyroiditis",

  // ==========================================
  // 5. MORE QUIRKS & DISEASES (Mod 1907320682)
  // ==========================================
  bonebreak_fever: "Bonebreak Fever",
  cholera: "Cholera",
  corpse_curse: "Corpse Curse",
  dropsy: "Dropsy",
  ghoul_fever: "Ghoul Fever",
  heart_rot: "Heart Rot",
  hiccups: "Hiccups",
  influx: "Influx",
  pale_mans_plight: "Pale Man's Plight",
  mind_rot: "Mind Rot",
  palsy: "Palsy",
  paroxysm: "Paroxysm",
  pink_eye: "Pink Eye",
  peckers_pox: "Pecker's Pox",
  pneumonia: "Pneumonia",
  psychosis: "Psychosis",
  shrieking_sickness: "Shrieking Sickness",
  the_common_cold: "The Common Cold",
  the_shakes: "The Shakes",
  tongue_tie: "Tongue-Tie",
  typhus: "Typhus",
  whooping_cough: "Whooping Cough",
  dancing_plague: "Dancing Plague",
  migraines: "Migraines",

  // ==========================================
  // 6. WARHAMMER VERMINTIDE (Mod 2683922974)
  // ==========================================
  warp_stone_addiction_exposed: "Warpstone Addiction: Exposed",
  warp_stone_addiction_radiating: "Warpstone Addiction: Radiating",
  warp_stone_addiction_tended: "Warpstone Addiction: Tended",
  vmt_black_lung: "Black Lung",
  vmt_deep_burn: "Deep Burn",
  vmt_chronic_fatigue: "Chronic Fatigue",
  vmt_acute_deafness: "Acute Deafness",
  vmt_tended_deafness: "Tended Deafness",
  vmt_inflammable_pyrogenesis: "Inflammable Pyrogenesis",
  vmt_dancing_eyes: "Dancing Eyes",
  vmt_deep_scar: "Deep Scar",

  // ==========================================
  // 7. KOALA'S CREATURE COLLECTION (Mod 2044162110)
  // ==========================================
  fishman_disease: "Pelagic Plague",
  fishman_quirk: "Pelagic Embrace",
  kcc_fungal_blood: "Fungal Blood",
  kcc_deep_blood: "Deep Blood",
  kcc_eldritch_blood: "Eldritch Blood",
  kcc_swine_blood: "Swine Blood",
  kcc_leprosy: "Leprosy",
  kcc_tinnitus: "Tinnitus",

  // ==========================================
  // 8. CLASS MODS & SPECIAL PROGRESSIONS
  // ==========================================
  HARL_cooties: "Cooties",
  HARL_warts: "Genital Warts",
  VV_quirk_0: "Cursed Scar",
  vv_quirk_light: "Darkbrood: Cleansing",
  VV_quirk_1: "Darkbrood",
  VV_quirk_2: "Darkspawn",
  VV_quirk_Rage: "Darkspawn: Frenzy",
  flesh_rot: "Flesh Curse",
  bloat_disease: "Divine Fever",
  binge: "Overfeeding",
  forsaken_disease: "Decomposition",
  maledictor_disease: "Writhevein",
  vampKraken_chompQuirk: "Kraekan Hunger",
  light_sensitive_disease: "Photophobia",
  MC_PTSD_1: "PTSD I",
  MC_PTSD_2: "PTSD II",
  MC_PTSD_3: "PTSD III",
  MC_PSYCHOSIS_1: "Psychosis Stage 1",
  MC_PSYCHOSIS_2: "Psychosis Stage 2",
  MC_PSYCHOSIS_3: "Psychotic",

  // Thalassophobia (Abyssal Dream Progression)
  thalassophobia1: "Abyssal Dream: Dormancy",
  thalassophobia2: "Abyssal Dream: Silence",
  thalassophobia3: "Abyssal Dream: Awakening",
  thalassophobia4: "Abyssal Dream: Clarity",
};

export function getDiseaseDisplayName(disease: DiseaseType): string {
  return DISEASE_DISPLAY_NAMES[disease] ?? disease;
}

export function isDisease(condition: string): condition is DiseaseType {
  return condition in DISEASE_DISPLAY_NAMES;
}
