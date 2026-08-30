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
  black_plague: "Severely reduces blight and disease resistances while penalizing maximum health and speed.",
  bad_humors: "Substantially lowers the hero's maximum health pool.",
  the_red_plague: "Greatly reduces bleed resistance and slightly lowers maximum health and critical strike chance.",
  the_ague: "Weakens the hero with penalties to damage, speed, and maximum health.",
  sky_taint: "Increases stress taken while lowering bleed and blight resistances.",
  syphilis: "Weakens overall combat capability with penalties to accuracy, damage, and maximum health.",
  creeping_cough: "Significantly reduces the hero's direct damage output.",
  lethargy: "Causes severe sluggishness, substantially lowering the hero's speed.",
  the_worries: "Amplifies all incoming stress damage by thirty percent.",
  hysterical_blindness: "Inflicts a massive accuracy penalty whenever the hero's stress rises above seventy.",
  the_runs: "Lowers maximum health and severely penalizes dodge.",
  tetanus: "Impairs weapon handling, reducing accuracy and critical strike chance.",
  hemophilia: "Halves the hero's innate resistance to bleeding.",
  spotted_fever: "Halves the hero's innate resistance to blight.",
  scurvy: "Weakens tissues, heavily reducing resistance to bleed and forced movement.",
  tapeworm: "Doubles food consumption and compels the hero to steal food from curios.",
  vertigo: "Severely reduces resistance to forced repositioning and knockback effects.",
  vampiric_spirits: "Halves the hero's resistance to incoming debuffs.",
  ennui: "Drastically reduces the hero's chance to become virtuous under stress.",
  wasting_sickness: "Halves the hero's natural resistance against contracting other diseases.",
  bulimic: "Reduces the effectiveness of healing skills during camp.",
  spasm_of_the_entrails: "Reduces the amount of health restored by camping skills.",
  rabies: "Grants a notable damage bonus at the cost of reduced accuracy.",
  the_fits: "Increases initiative and speed at the cost of accuracy and critical strike chance.",
  grey_rot: "Grants bonus maximum health while reducing accuracy and damage output.",

  // Crimson Curse & Hive States
  disease_vampire_passive: "Inflicts minor debuffs to resistances and health while slightly increasing speed.",
  disease_vampire_crave: "Increases speed and lowers virtue chance while the hero hungers for blood.",
  disease_vampire_wasting: "Heavily penalizes health, speed, and deathblow resistance until blood is consumed.",
  disease_vampire_blood_lust: "Grants massive boosts to damage, speed, and resistances during a violent blood-fueled frenzy.",
  hive_vampire_passive: "A mutated strain of the Crimson Curse that alters base resistances and health scaling.",
  hive_vampire_crave: "Causes the hero to crave blood, gaining speed while becoming more vulnerable to stress.",
  hive_vampire_wasting: "Severely weakens combat stats and health until the craving is sated.",
  hive_vampire_blood_lust: "Grants powerful offensive buffs and increased resistances during bloodlust.",

  // ==========================================
  // 2. EVOLVING DISEASES OVERHAUL (Mod 1381630368)
  // ==========================================
  // Stage 1 (Early Symptoms)
  the_black_plague_1: "Mild swelling that slightly reduces dodge and speed.",
  the_red_plague_1: "Stomach pain and nausea that causes the hero to periodically vomit.",
  the_ague_1: "A fever that slightly lowers maximum health, debuff resistance, and increases damage taken.",
  cysticercosis_1: "Early anemia that reduces speed and dodge.",
  scythe_blood_1: "Minor swelling in the limbs that causes fatigue, slightly lowering speed and dodge.",
  bad_humours_1: "Causes mild agitation that slightly reduces resolve check chances.",
  hemophilia_1: "Stomach pain that reduces eating heals and slightly lowers dodge.",
  the_runs_1: "Stomach pain that impairs digestion and lowers dodge.",
  tetanus_1: "A persistent headache that slightly lowers accuracy and increases stress received.",
  rabies_1: "An intense headache that slightly lowers accuracy and increases stress taken.",
  lethargy_1: "An unusual temper that slightly lowers resolve check chances.",
  spotted_fever_1: "A dull headache that slightly reduces accuracy and increases stress.",
  vertigo_1: "Dizziness and headache that slightly lower accuracy and increase stress.",
  hysterical_blindness_1: "Eye irritation that slightly lowers accuracy and critical strike chance.",
  scurvy_1: "Tiredness that slightly reduces accuracy and stun resistance.",
  the_worries_1: "Severe paranoia that increases incoming stress damage by thirty percent.",
  griping_guts_1: "Abdominal discomfort that lowers dodge and meal healing.",
  the_fits_1: "Mild muscle spasms that slightly reduce accuracy and critical strike chance.",
  epilepsy_1: "A tension headache that slightly impairs accuracy and raises stress.",
  dementia_1: "Mild dizziness that slightly lowers accuracy and raises stress.",
  coeliac_1: "Digestive discomfort that reduces dodge and meal healing.",
  red_weeping_1: "Severe eye irritation that slightly impairs accuracy and critical strike chance.",
  creeping_cough_1: "A roughened voice that reduces stress recovery during camping.",
  madness_1: "A strange intuition that increases accuracy at the cost of extra stress.",
  possession_1: "Auditory unease that increases accuracy while raising stress taken.",
  haunt_1: "A feeling of being watched that slightly increases accuracy and stress.",
  syphilis_1: "An initial chancre that has not yet impaired combat effectiveness.",
  bulimic_1: "A growing hunger that increases food healing while reducing camping efficiency.",

  // Stage 2 (Intermediate Progressions)
  the_black_plague_2: "Dying flesh that strips blight and deathblow resistances while reducing damage.",
  bad_humours_2: "Causes growing hysteria that impairs resolve and stresses allies.",
  hemophilia_2: "Advanced anemia that reduces speed and dodge.",
  the_runs_2: "Severe diarrhea that lowers maximum health, dodge, and protection.",
  tetanus_2: "Occasional uncontrollable seizures that cause turn skips and self-harm.",
  lethargy_2: "Deep ennui that lowers speed, critical strike chance, and resolve checks.",
  the_ague_2: "Malaria symptoms that reduce maximum health and debuff resistance.",
  cysticercosis_2: "A tapeworm infection that increases stress and reduces eating healing.",
  the_red_plague_2: "An inflamed rash that lowers bleed resistance and increases damage taken.",
  scythe_blood_2: "Severe anemia that causes noticeable penalties to speed and dodge.",
  spotted_fever_2: "An inflamed rash that lowers bleed resistance and increases damage taken.",
  hysterical_blindness_2: "Ceaseless bloodshot eyes that penalize accuracy and critical strike chance.",
  scurvy_2: "Fragile, bleeding skin that reduces bleed resistance.",
  griping_guts_2: "Frequent vomiting that causes turn loss and stress.",
  epilepsy_2: "Developing seizures that can force turn skips during combat.",
  coeliac_2: "Progressing digestive failure that penalizes speed and dodge.",
  red_weeping_2: "Bloodshot eyes that impair accuracy and surprise resistance.",
  creeping_cough_2: "A burning throat that lowers debuff resistance and camping healing.",
  rabies_2: "Bloodshot eyes that reduce accuracy and critical strike chance.",
  syphilis_2: "A diffuse rash that increases all damage taken.",
  vertigo_2: "Disorientation that lowers dodge and scouting chance.",
  dementia_2: "Mental disorientation that lowers dodge and scouting chance.",
  madness_2: "Dawning madness that boosts accuracy while increasing stress taken.",
  possession_2: "Hearing voices that cause notable stress damage.",
  haunt_2: "Hearing voices and seeing apparitions that increase stress taken.",
  the_fits_2: "Worsening seizures that cause stress and command hesitation.",
  bulimic_2: "Ravenous cravings that compel the hero to hoard and steal food curios.",
  the_worries_2: "The condition begins to improve, reducing the stress penalty to twenty percent.",

  // Stage 3 (Severe / Lethal Stages)
  the_black_plague_3: "Completely strips blight and deathblow resistances, proving fatal if left untreated.",
  tetanus_3: "Causes agonizing full-body spasms that disrupt actions and will cause death if left untreated.",
  cysticercosis_3: "Parasitic nervous infection that causes erratic behavior and death if untreated.",
  rabies_3: "Violent rabies that induces friendly fire and causes death if left untreated.",
  scythe_blood_3: "Catastrophic blood failure that strips bleed and disease resistances while lowering health.",
  syphilis_3: "Full-blown syphilis that inflicts broad penalties across all resistances, dodge, and accuracy.",
  bad_humours_3: "Makes the hero extremely erratic, irritable, and difficult to control in battle.",
  hemophilia_3: "Severe hemophilia that cripples bleed resistance, protection, and incoming healing.",
  lethargy_3: "Total exhaustion that inflicts massive penalties to speed and critical strike chance.",
  the_ague_3: "Severe ague that heavily reduces speed, disease resistance, and debuff resistance.",
  the_red_plague_3: "Severe red plague that heavily lowers bleed resistance and inflicts combat strain.",
  spotted_fever_3: "Weakens the constitution with penalties to health, bleed, blight, and debuff resistances.",
  scurvy_3: "Severe scurvy that cripples healing received and lowers accuracy, dodge, and stun resistance.",
  griping_guts_3: "Violent upheavals that reduce maximum health and ruin camping recovery.",
  epilepsy_3: "Severe epilepsy that causes frequent seizures and turn skips in combat.",
  hysterical_blindness_3: "Severe hallucinations and unquiet eyes that inflict heavy accuracy and stress penalties.",
  madness_3: "Total mental break that increases incoming stress damage by fifty percent.",
  creeping_cough_3: "Violent coughing fits that reduce damage and debuff resistance while causing turn skips.",
  red_weeping_3: "Bleeding from the eyes that severely reduces accuracy and causes self-harm.",
  vertigo_3: "Debilitating vertigo that lowers accuracy, dodge, and move resistance.",
  dementia_3: "Faltering memory that causes confusion, self-inflicted hits, and erratic movement.",
  coeliac_3: "Complete refusal to eat meals during camping, risking starvation.",
  haunt_3: "Supernatural terror that compels the hero to mark themselves in battle.",
  bulimic_3: "Uncontrollable compulsion to consume food and steal supply curios.",
  the_fits_3: "Violent twitching that grants speed and critical strike chance at the cost of heavy accuracy loss.",
  possession_3: "Supernatural entity takes control, granting combat bonuses while acting unpredictably.",
  the_worries_3: "The condition has subsided into a mild, manageable state of unease.",

  // Combat Physical Injuries
  concussion: "Head trauma that impairs focus, speed, and accuracy.",
  broken_shield_arm: "A crushed shield arm that reduces guard effectiveness, protection, and dodge.",
  torn_rotator: "A shoulder injury that weakens melee attacks and lowers accuracy.",
  open_wound: "A gaping wound that reduces bleed resistance and maximum health.",
  wrenched_knee: "A severe knee sprain that reduces speed and move resistance.",
  puncture_wound: "A deep puncture that makes the hero vulnerable to bleed and blight.",
  deafened: "Loss of hearing that lowers surprise resistance and scouting chance.",
  tinnitus: "Ringing ears that slightly reduce stress recovery and perception.",

  // Curses & Decaying Occult Traits
  Iron_Maiden: "Causes the hero to suffer sympathetic damage whenever an ally is hit.",
  Life_Tapped: "Causes the hero's bleeding wounds to restore health to enemies.",
  Deadwood_Gaze: "Induces intense paranoia regarding an invisible entity, disrupting combat actions.",
  Raine_Jinx: "Reduces all skill chances and all resistances by ten percent.",
  Outsiders_Vex: "Makes every physical blow feel concussive, causing high stress on hit.",
  Carnaces_Cradle: "Summons supernatural darkness that snuffs out torchlight upon victory.",
  Aberant_Spiral: "Causes the hero to despair and panic whenever allies miss attacks.",
  Drachan_Spite: "A lingering curse that imposes broad statistical penalties before fading away.",
  Decaying_Rudiment: "A decaying hex that temporarily weakens the hero before curing itself.",
  Dry_Burden: "A supernatural burden that reduces speed and mobility until it expires.",
  Fragmented_Vision: "A distorting curse that temporarily hinders accuracy and scouting.",
  RCurse_2: "The weakened remnants of an occult curse that is about to fade away completely.",

  // Eldritch Evolution
  blood_taint_1: "An eldritch blood infection that forces self-harm and evolves over time.",
  minds_eye_1: "An expanding cosmic awareness that increases stress vulnerability and evolves over time.",
  Fractured_body_1: "A physical fracturing across dimensions that evolves over time.",
  perfect_revelation: "A permanent eldritch state that triples stress gained but grants immense bonuses when afflicted or virtuous.",

  // ==========================================
  // 3. EAST TOWN / SUNWARD ISLES
  // ==========================================
  tuberculosis: "Consumptive lung failure that heavily reduces damage and dodge while eliminating food intake.",
  typhoid: "Enteric fever that halves deathblow resistance and penalizes dodge and debuff resistance.",
  myo: "Severe myocarditis that halves deathblow resistance and lowers stun resistance.",
  smallpox: "A deadly pox that reduces maximum health by a quarter and lowers protection.",
  gangrene: "Necrotic tissue that reduces maximum health and completely blocks healing.",
  hookworm: "Parasitic infection that reduces maximum health and severely cripples bleed resistance.",
  lead: "Severe lead poisoning that lowers accuracy, maximum health, and virtue chance.",
  dipth: "Diphtheria that heavily reduces damage output while slightly increasing stress.",
  dysentery: "Severe bowel infection that reduces speed, doubles food consumption, and impairs healing.",
  kawasaki: "An inflammatory disease that increases damage received and lowers debuff skill chance.",
  nihonnouen: "Japanese encephalitis that increases damage taken from bleed and blight effects.",
  measles: "High fever and rash that reduces maximum health and increases stress vulnerability.",
  mono: "Glandular fever that increases stress received and lowers disease resistance.",
  koshou: "A systemic ailment that reduces maximum health and raises stress taken.",
  rheumatism: "Joint inflammation that reduces critical strike chance by fifteen percent.",
  beriberi: "Nervous deficiency that lowers speed and causes random turn actions despite granting protection.",
  insane: "A manic state that increases incoming stress damage.",
  hashimoto: "Thyroid disorder that reduces speed and lowers healing received.",

  // ==========================================
  // 4. DISEASY DOES IT (Mod 2342665064)
  // ==========================================
  aids: "Severe immune suppression that cripples disease resistance and all secondary resistances.",
  sepsis: "Bloodstream infection that lowers critical strike chance and risks fatal septic shock.",
  bone_death: "Severe bone necrosis that drastically penalizes speed and dodge.",
  living_death: "A state of suspended vitality that lowers maximum health and speed.",
  influenza: "The flu, causing notable reductions to damage output, stun resistance, and debuff resistance.",
  meningitis: "Brain membrane inflammation that reduces health and causes daze and confusion.",
  narcolepsy: "A neurological condition that causes the hero to fall asleep and skip turns unpredictably.",
  rickets: "Bone softening that reduces maximum health, protection, and speed.",
  hypertension: "High blood pressure that risks severe combat strain during prolonged battles.",
  anorexia: "Eating disorder that reduces maximum health and triggers starvation penalties.",
  geist_fever: "Whispering fever that reduces damage output and increases stress taken.",
  asthma: "Respiratory distress that triggers sudden damage and critical strike penalties.",
  otitis: "Inner ear infection that heavily penalizes dodge, stun resistance, and move resistance.",
  lupus: "Autoimmune disease that causes periodic flare-ups reducing speed and damage.",
  pyrohemia: "Supernatural internal burning that inflicts self-harm during combat.",
  thyroiditis: "Thyroid inflammation that reduces maximum health and accuracy.",
  panic_disorder: "Severe anxiety that increases surprise chances and triggers horror effects.",
  glassy_eye: "Clouded vision that reduces accuracy and raises stress taken.",
  hepatitis: "Liver inflammation that significantly reduces blight and debuff resistances.",
  scoliosis: "Spinal curvature that impairs trap disarm chance, dodge, and speed.",
  astigmatism: "Irregular cornea curvature that causes erratic accuracy and damage output.",
  the_chills: "Involuntary shivering that reduces speed and dodge.",
  solar_urticaria: "Severe sun allergy that causes hives and weakness in bright torchlight.",
  acid_pustules: "Caustic boils that burst and splash damage onto the hero when struck.",
  aether_curse: "A cosmic curse that reduces stress taken at the cost of skill application chances.",
  shadow_stigma: "A shadowy affliction that heavily reduces dungeon scouting chance.",
  migraine: "Severe throbbing headaches that impair combat focus and raise stress.",
  bad_breath: "Foul breath that causes minor social irritation among party members.",

  // ==========================================
  // 5. MORE QUIRKS & DISEASES (Mod 1907320682)
  // ==========================================
  corpse_curse: "Necrotic corruption that lowers health, disease resistance, and deathblow resistance.",
  heart_rot: "Cardiovascular decay that severely lowers deathblow and bleed resistances.",
  cholera: "Acute intestinal infection that severely drains the hero's maximum health.",
  bonebreak_fever: "Severe joint fever that reduces damage output and speed.",
  pink_eye: "Conjunctivitis that inflicts a twenty-point accuracy penalty.",
  psychosis: "Mental breakdown that reduces stress resistance and virtue chance.",
  the_shakes: "Uncontrollable trembling that penalizes critical strike chance and causes random targeting.",
  typhus: "Severe bacterial infection that reduces incoming healing, stress healing, and speed.",
  dropsy: "Fluid buildup that increases damage taken and lowers bleed and blight resistances.",
  influx: "Internal swelling that reduces dodge by twenty points.",
  pale_mans_plight: "A draining wasting disease that halves disease resistance and lowers bleed resistance.",
  mind_rot: "Mental deterioration that reduces speed and dodge.",
  pneumonia: "Lung infection that reduces maximum health.",
  whooping_cough: "Persistent severe coughing that lowers accuracy, speed, and disease resistance.",
  peckers_pox: "A nuisance disease that lowers critical strike chance and increases critical hits taken.",
  shrieking_sickness: "A harrowing infection that reduces dodge and disease resistance.",
  dancing_plague: "Compulsive movement that lowers move resistance and forces involuntary step shifts.",
  palsy: "Nerve paralysis that reduces stun resistance.",
  migraines: "Severe headaches that lower dodge and stress resistance.",
  ghoul_fever: "Ghoulish hunger that grants bonus damage at the cost of stress resistance and extra food intake.",
  paroxysm: "Sudden spasms that reduce disease resistance.",
  hiccups: "Involuntary diaphragm spasms that slightly reduce accuracy.",
  the_common_cold: "A mild respiratory illness that slightly lowers disease resistance.",
  tongue_tie: "Speech impediment that restricts hero dialogue and minor camping barks.",

  // ==========================================
  // 6. WARHAMMER VERMINTIDE (Mod 2683922974)
  // ==========================================
  vmt_black_lung: "Inhalation of toxic warp-mine dust that penalizes speed, damage, and critical strike chance.",
  vmt_deep_scar: "A severe warpstone wound that reduces health, deathblow resistance, and prevents curing damage-over-time effects.",
  vmt_deep_burn: "Chemical burns that lower bleed, blight, and disease resistances.",
  vmt_dancing_eyes: "Uncontrollable eye darting that causes attacks to strike random targets.",
  vmt_acute_deafness: "Explosive hearing loss that reduces stun and move resistances while impairing stress relief skills.",
  vmt_inflammable_pyrogenesis: "Volatile chemistry that increases damage taken but boosts torchlight retention.",
  warp_stone_addiction_exposed: "Unrefined warpstone exposure that boosts damage and speed at the cost of increased stress received.",
  vmt_chronic_fatigue: "Lingering warp sickness that severely reduces stress recovery in all Hamlet facilities.",
  vmt_tended_deafness: "Partially recovered hearing loss that slightly reduces stun and move resistances.",
  warp_stone_addiction_radiating: "Powerful warp mutation that grants immense speed, damage, and resist buffs with volatile side effects.",
  warp_stone_addiction_tended: "Stabilized warpstone reliance that grants modest damage and speed bonuses.",

  // ==========================================
  // 7. KOALA'S CREATURE COLLECTION (Mod 2044162110)
  // ==========================================
  fishman_disease: "Pelagic plague that reduces health and raises stress while granting speed and damage buffs.",
  kcc_leprosy: "Advanced leprosy that reduces resistances, increases damage taken, and raises stress.",
  fishman_quirk: "An advanced pelagic mutation granting potent aquatic combat buffs and deeper penalties.",
  kcc_fungal_blood: "Fungal spores in the blood that increase combat stats against marked targets but penalize unmarked attacks.",
  kcc_deep_blood: "Deep-sea blood that provides stress buffs when wounded below half health.",
  kcc_tinnitus: "Ear damage that reduces the amount of stress healed by party skills.",
  kcc_eldritch_blood: "Alien blood that grants broad resistance bonuses in exchange for increased stress vulnerability.",
  kcc_swine_blood: "Swine blood that increases maximum health and disease resistance at the cost of higher food consumption.",

  // ==========================================
  // 8. CLASS MODS & SPECIAL PROGRESSIONS
  // ==========================================
  MC_PTSD_3: "Severe combat trauma that triggers frequent panic, hesitation, and stress spikes.",
  MC_PSYCHOSIS_3: "Full psychotic breakdown that severely disrupts action control and combat reliability.",
  forsaken_disease: "Advanced tissue decomposition that inflicts severe damage and stress when hungry or starving.",
  flesh_rot: "Corrupting flesh rot that lowers health, increases damage taken, and causes disease complications.",
  VV_quirk_2: "Advanced vampiric corruption that drastically alters combat attributes and blood reliance.",
  maledictor_disease: "Parasitic writhevein that increases food consumption and reduces healing received.",
  MC_PTSD_2: "Moderate combat trauma that periodically impairs actions during stressful fights.",
  MC_PSYCHOSIS_2: "Moderate psychosis that impairs resolve and causes erratic combat behaviors.",
  bloat_disease: "Divine fever that grants combat bonuses based on the number of active blight effects.",
  light_sensitive_disease: "Extreme photophobia that reduces damage output when fighting in high torchlight.",
  VV_quirk_Rage: "Vampiric frenzy that grants massive offensive boosts while sending the hero into a blood rage.",
  VV_quirk_1: "Early vampiric strain that alters bloodlust and light sensitivity.",
  MC_PSYCHOSIS_1: "Early signs of psychosis that slightly increase stress vulnerability.",
  HARL_warts: "Venereal warts that slightly reduce speed and incoming healing.",
  vampKraken_chompQuirk: "Kraeken hunger that causes the hero to compulsively consume double provisions.",
  MC_PTSD_1: "Early combat fatigue that slightly reduces surprise and stress resistances.",
  HARL_cooties: "A minor nuisance infection that slightly reduces speed, critical strike chance, and debuff resistance.",
  vv_quirk_light: "A cleansed strain of vampiric blood that grants minor defensive benefits.",
  binge: "Overfeeding that grants bonus maximum health at the cost of one point of speed.",
  VV_quirk_0: "A lingering cursed scar that slightly alters resolve and resistance stats.",

  // Thalassophobia (Abyssal Dream Progression)
  thalassophobia3: "Awakening dream that merges reality and nightmare, causing moderate stress and disorientation.",
  thalassophobia2: "Silence of the deep that weakens resolve and induces mild confusion.",
  thalassophobia4: "Clarity attained by mastering the abyssal dream, stabilizing the mind against further erosion.",
  thalassophobia1: "Dormant abyssal dreams that cause subtle, occasional mental unease.",
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

export function isDisease(id: string): id is DiseaseType {
  return id in DISEASE_SEVERITY;
}
