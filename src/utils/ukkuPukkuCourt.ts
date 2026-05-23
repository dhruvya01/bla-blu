export interface Fact {
  id: string;
  category: "anjali" | "dhruvya" | "both" | "inside_joke";
  text: string;
}

export interface CourtProfile {
  sleepingQueen?: string; // "Anjali" | "Dhruvya" | "Both"
  studyOrJob?: string; // e.g., "Dhruvya is coding and gymming, Anjali is the queen of pouting"
  favoriteMomoPlace?: string; // e.g., "Kalsang Cafe Dehradun"
  nicknames?: {
    anjali?: string; // e.g., "baccha", "cutie", "queen"
    dhruvya?: string; // e.g., "bondu", "dino", "golu"
  };
  dailyRitual?: string; // e.g., "video calling before bed", "sending 100 cute Instagram reels"
}

export interface DialogueNode {
  speaker: "Judge 🧑‍⚖️" | "Anjali 💖" | "Dhruvya 🦖" | "System 📜";
  text: string;
  expression?: "angry" | "happy" | "sad" | "pout" | "shocked" | "normal";
}

export interface CourtTrial {
  mistakeTitle: string;
  accusedName: string;
  prosecutorName: string;
  dialogues: DialogueNode[];
  pointDistribution: {
    anjaliScore: number;
    dhruvyaScore: number;
    guiltyParty: "Anjali" | "Dhruvya" | "Both" | "None";
    winner: "Anjali" | "Dhruvya" | "None";
  };
  verdictText: string;
  punishmentText: string;
}

export interface CourtQuestions {
  accused: string;
  prosecutor: string;
}

/**
 * Returns highly customized, dynamic questions tailored to the specific mistake, randomly choosing
 * from different inquiry angles to ensure a fresh experience. Takes Custom Profile parameters
 * to weave their real details directly into the questions!
 */
export function getUkkuPukkuQuestions(
  mistakeTitle: string,
  accusedName: string,
  prosecutorName: string,
  profile?: CourtProfile | null
): CourtQuestions {
  const titleLower = mistakeTitle.toLowerCase();
  const seed = Math.random();

  // Extract variables
  const aNick = profile?.nicknames?.anjali || "baby";
  const dNick = profile?.nicknames?.dhruvya || "bondu boy";
  const momoLoc = profile?.favoriteMomoPlace || "the local streets";
  const sleepQueen = profile?.sleepingQueen || "Anjali";
  const dailyRit = profile?.dailyRitual || "video calls";

  // 1. REPLIES, CHAT, LATENCY, MESSAGES
  if (
    titleLower.includes("reply") || 
    titleLower.includes("phone") || 
    titleLower.includes("message") || 
    titleLower.includes("ignore") || 
    titleLower.includes("chat") ||
    titleLower.includes("call") ||
    titleLower.includes("delay") ||
    titleLower.includes("seen")
  ) {
    if (seed < 0.33) {
      return {
        accused: `${accusedName} (${accusedName === "Anjali" ? aNick : dNick}), the satellites recorded extreme transmission lags! Why did you keep ${prosecutorName} waiting during your precious ${dailyRit} hours? Explain yourself!`,
        prosecutor: `${prosecutorName} (${prosecutorName === "Anjali" ? aNick : dNick}), what was your exact state of pouting during this silence? Did you double-tap in anger or browse reels in grief?`
      };
    } else if (seed < 0.66) {
      return {
        accused: `${accusedName}, explain why virtual screen time was interrupted! Did your phone run out of battery, or did your brain do a system restart like a rusty laptop?`,
        prosecutor: `${prosecutorName}, given that you deserve 24/7 hyper-active notifications from ${accusedName}, how many minutes of apology snuggle time does your pouted heart demand?`
      };
    } else {
      return {
        accused: `${accusedName}, the Relationship Code strictly prohibits ignoring texts. How do you defend your slower typing speed and typing indicator delay?`,
        prosecutor: `${prosecutorName}, should we order the Magistrates to install immediate push alerts on ${accusedName}'s screen, labeled 'SAY GOOD MORNING/LOVE IMMEDIATELY'?`
      };
    }
  }
  
  // 2. SLEEPING EARLY, SNORING, AWAKE SCHEDULES
  if (
    titleLower.includes("sleep") || 
    titleLower.includes("awake") || 
    titleLower.includes("asleep") || 
    titleLower.includes("night") || 
    titleLower.includes("snore") ||
    titleLower.includes("morning") ||
    titleLower.includes("wake")
  ) {
    const isSleepQueenTarget = sleepQueen === accusedName;
    if (seed < 0.33) {
      return {
        accused: `${accusedName}, the designated Sleeping Majesty! Why did you slip into deep cozy hibernation without saying your sweet, long Goodnights or delivering sweet forehead kisses?`,
        prosecutor: `${prosecutorName}, with ${accusedName} sleeping like a log, how cold and empty was your digital pillow? How many long-distance virtual hugs must be transacted?`
      };
    } else if (seed < 0.66) {
      return {
        accused: `${accusedName}, explain why your sleepy brain decided to snooze while ${prosecutorName} was waiting to chat! Do you plead guilty to Sleepy Negligence on call?`,
        prosecutor: `${prosecutorName}, given that we operate under the Cozy Sleeping Act, should we sentence ${accusedName} to stay awake for a 1-hour midnight sweet talking session?`
      };
    } else {
      return {
        accused: `${accusedName}, sleeping early is fine, but falling asleep during active loving cuddles is illegal. What is your sleepy defense?`,
        prosecutor: `${prosecutorName}, did your partner snore too early or sleep before planning Dehradun reunion events? Detail your cozy demands!`
      };
    }
  }

  // 3. AFFECTION, KISSES, HUGS, LOVE, PAMPERING
  if (
    titleLower.includes("kiss") || 
    titleLower.includes("hug") || 
    titleLower.includes("love") || 
    titleLower.includes("cuddle") || 
    titleLower.includes("care") || 
    titleLower.includes("pout") ||
    titleLower.includes("pamper") ||
    titleLower.includes("neglect")
  ) {
    if (seed < 0.5) {
      return {
        accused: `${accusedName} (${accusedName === "Anjali" ? aNick : dNick}), the cuddly quotient dropped below standard safety levels! Why has the daily quota of sweet forehead kisses been neglected?`,
        prosecutor: `${prosecutorName} (${prosecutorName === "Anjali" ? aNick : dNick}), you deserve absolute royal pampering at all hours. Specify the exact cheeks-pinching damage count you request.`
      };
    } else {
      return {
        accused: `${accusedName}, love is a full-time constitutional job! Why didn't you deliver maximum cute energy and lovely reassurance to your darling?`,
        prosecutor: `${prosecutorName}, describe the dreamy snuggle scenario for when you meet in Dehradun. What cuddling configurations must this court order?`
      };
    }
  }

  // 4. FOOD, MOMOS, TREATS, MOGU MOGU, CRAVINGS
  if (
    titleLower.includes("food") || 
    titleLower.includes("eat") || 
    titleLower.includes("momo") || 
    titleLower.includes("treat") || 
    titleLower.includes("drink") || 
    titleLower.includes("mogu") || 
    titleLower.includes("water") || 
    titleLower.includes("dinner") ||
    titleLower.includes("lunch")
  ) {
    if (seed < 0.5) {
      return {
        accused: `${accusedName}, eating delicious treats without sending a cute food photo or planning a matching food delivery to ${prosecutorName} is classified as Hungry Hoarding! Why didn't you share?`,
        prosecutor: `${prosecutorName}, did they eat without ordering momos for you or promising a treat at ${momoLoc}? What delicious restitution should we impose?`
      };
    } else {
      return {
        accused: `${accusedName}, you are accused of neglecting to pamper your partner with sweet Dehradun treats! Why weren't Peach/Litchi Mogu Mogu drinks delivered to their virtual doorstep?`,
        prosecutor: `${prosecutorName}, does your sweet tooth officially request a Court-Ordered Cozy Dinner and Momo date or chocolate box?`
      };
    }
  }

  // 5. MOODY, ANGRY, TEMPER, ATTITUDE, FIGHTS
  if (
    titleLower.includes("angry") || 
    titleLower.includes("fight") || 
    titleLower.includes("mood") || 
    titleLower.includes("rude") || 
    titleLower.includes("attitude") ||
    titleLower.includes("temper")
  ) {
    if (seed < 0.5) {
      return {
        accused: `${accusedName}, displaying a moody attitude or raising your cute temper against your darling sweetheart is a serious infraction. What triggered this sweet-system alert?`,
        prosecutor: `${prosecutorName}, despite your high angelic threshold, you suffered a mini-attitude blow. What apologizing code, tickling session, or emotional insurance payout do you require?`
      };
    } else {
      return {
        accused: `${accusedName}, mental or physical tiredness happens, but discharging high-voltage grumpiness on ${prosecutorName} is strictly illegal in relation-court! What is your sweet plea?`,
        prosecutor: `${prosecutorName}, did your sweetheart apologize with enough puppy eyes? If not, what custom punishment do we decree?`
      };
    }
  }

  // 6. DEFAULT / FALLBACK
  if (seed < 0.33) {
    return {
      accused: `${accusedName} (${accusedName === "Anjali" ? aNick : dNick}), you are summoned for: "${mistakeTitle}". Speak under relationship oath — how will you repair their sweet heart today?`,
      prosecutor: `${prosecutorName} (${prosecutorName === "Anjali" ? aNick : dNick}), state the level of pouting this action caused on a scale from 1 to 100! What penalty feels fair?`
    };
  } else if (seed < 0.66) {
    return {
      accused: `${accusedName}, your actions caused a severe snuggle imbalance. How do you defend your silly brain under the light of Dehradun joint jurisdiction?`,
      prosecutor: `${prosecutorName}, the court stands ready to validate your demands. What cute favors, sweet texts, or reels should the accused deliver?`
    };
  } else {
    return {
      accused: `${accusedName}, your trial has officially commenced! Give us a highly creative, cute explanation for this silly move right now!`,
      prosecutor: `${prosecutorName}, please testify. How long must you receive absolute, uninterrupted royal pampering to forgive this sweet offense?`
    };
  }
}

/**
 * Helper function to parse user answers in real-time and return funny reactive judicial commentary.
 */
function analyzeSpeech(speechText: string, speakerName: string, profile?: CourtProfile | null): string {
  const lower = speechText.toLowerCase();
  if (!speechText || speechText.trim().length === 0) {
    return `[The subject remained affectionately silent, pouting and demanding silent cuddles]`;
  }

  const reactions: string[] = [];
  const aNick = profile?.nicknames?.anjali || "baccha";
  const dNick = profile?.nicknames?.dhruvya || "bondu";
  const momoLoc = profile?.favoriteMomoPlace || "Kalsang Dehradun";

  if (lower.includes("sorry") || lower.includes("apologize") || lower.includes("maaf") || lower.includes("galti") || lower.includes("mishap")) {
    reactions.push(`The Court explicitly notes that ${speakerName} exhibits deep, sweet remorse and wishes to restore absolute love.`);
  }
  if (lower.includes("baby") || lower.includes("baccha") || lower.includes("cute") || lower.includes("pout") || lower.includes("chotu")) {
    reactions.push(`The subject is heavily relying on the 'I am literally just a baby' immunity defense, which usually makes Anjali 100% immune.`);
  }
  if (lower.includes("love") || lower.includes("pyar") || lower.includes("cuddle") || lower.includes("hug") || lower.includes("snuggle")) {
    reactions.push(`Cuddling parameters mentioned! The court measures an overflow of deep snuggly warmth.`);
  }
  if (lower.includes("momo") || lower.includes("eat") || lower.includes("mogu") || lower.includes("peach")) {
    reactions.push(`Culinary sweet spot detected! A mental image of consuming juicy spicy momos with peach Mogu Mogu at ${momoLoc} is entering court records.`);
  }
  if (lower.includes("dehradun") || lower.includes("meet") || lower.includes("october") || lower.includes("college") || lower.includes("visit")) {
    reactions.push(`This references the beautiful Dehradun college reunion and cohabitation plans, which automatically unlocks the Cozy Sovereign Accord.`);
  }
  if (lower.includes("gym") || lower.includes("coding") || lower.includes("singing") || lower.includes("busy") || lower.includes("study")) {
    reactions.push(`High level excuse alert! Citing intensive ${profile?.studyOrJob || `hobbies like coding or gymming`} to justify response delays.`);
  }

  if (reactions.length === 0) {
    reactions.push(`The statement says: "${speechText.substring(0, 45)}${speechText.length > 45 ? '...' : ''}", which the Judge evaluates as a highly passionate plea!`);
  }

  return reactions.join(" ");
}

/**
 * Generates a fully personalized courtroom hearing simulation with rich dynamic paths.
 * Generates a DIFFERENT opinion, judicial personality, and reactive dialogues every single time,
 * customized around their specific mistake title!
 */
export function generateUkkuPukkuCourtTrial(
  mistakeTitle: string,
  loggedByName: string,
  loggedByUid: string,
  currentUserId: string,
  partnerName: string,
  facts: Fact[] = [],
  accusedAnswer?: string,
  prosecutorAnswer?: string,
  profile?: CourtProfile | null
): CourtTrial {
  const isDhruvyaAccused = loggedByName.toLowerCase().includes("anjali") === false;
  
  const accusedName = isDhruvyaAccused ? "Dhruvya" : "Anjali";
  const prosecutorName = isDhruvyaAccused ? "Anjali" : "Dhruvya";

  // Retain nicknames
  const aNick = profile?.nicknames?.anjali || "baby";
  const dNick = profile?.nicknames?.dhruvya || "bondu boy";
  const momoLoc = profile?.favoriteMomoPlace || "Kalsang";
  const dailyRit = profile?.dailyRitual || "sending sweet reels";
  const sleepingQ = profile?.sleepingQueen || "Anjali";

  // Roll from distinct judicial personalities & opinions for extreme variety!
  const judicialMoodSeed = Math.random();
  let judicialProfile = "Standard Sweet cuddly litigation";
  let isAnjaliWinningRoll = true;
  let judgeExpression: "angry" | "happy" | "sad" | "pout" | "shocked" | "normal" = "normal";

  if (judicialMoodSeed < 0.05) {
    judicialProfile = "The Hungry Momo Overlord Magistrate";
    isAnjaliWinningRoll = true;
    judgeExpression = "shocked";
  } else if (judicialMoodSeed < 0.10) {
    judicialProfile = "The Dehradun Long Distance Warden";
    isAnjaliWinningRoll = true;
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.15) {
    judicialProfile = "Absolute Baby Hood Immunity Council";
    isAnjaliWinningRoll = true;
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.20) {
    judicialProfile = "The Sleepy Snoring Beauty Tribunal";
    isAnjaliWinningRoll = true;
    judgeExpression = "pout";
  } else if (judicialMoodSeed < 0.25) {
    judicialProfile = "High Voltage Pouting Authority Docs";
    isAnjaliWinningRoll = true;
    judgeExpression = "angry";
  } else if (judicialMoodSeed < 0.30) {
    judicialProfile = "Double Cuddle Mutual Treaty Accord";
    isAnjaliWinningRoll = false; // Double Cuddle Acquittal!
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.35) {
    judicialProfile = "The Reels-Overlord Delay Penalty Commission";
    isAnjaliWinningRoll = true;
    judgeExpression = "shocked";
  } else if (judicialMoodSeed < 0.40) {
    judicialProfile = "The Sweet Forehead Kiss Inspectors";
    isAnjaliWinningRoll = true;
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.45) {
    judicialProfile = "Sarcastic AI Error Code Logic Panel";
    isAnjaliWinningRoll = true;
    judgeExpression = "normal";
  } else if (judicialMoodSeed < 0.50) {
    judicialProfile = "The Dinosaur Snicker and Grump Tribunal";
    isAnjaliWinningRoll = true;
    judgeExpression = "pout";
  } else if (judicialMoodSeed < 0.55) {
    judicialProfile = "Litchi Mogu Mogu Sovereign Supreme Office";
    isAnjaliWinningRoll = true;
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.67) {
    judicialProfile = "The Snapchat Exam Interrogation Council (Sept 28, 2024)";
    isAnjaliWinningRoll = true;
    judgeExpression = "shocked";
  } else if (judicialMoodSeed < 0.79) {
    judicialProfile = "The October 10 Confession & Ghosting Precedent Jury";
    isAnjaliWinningRoll = true;
    judgeExpression = "happy";
  } else if (judicialMoodSeed < 0.90) {
    judicialProfile = "The JEE vs Commerce Academic Supremacy Bench";
    isAnjaliWinningRoll = true;
    judgeExpression = "normal";
  } else if (judicialMoodSeed < 0.95) {
    judicialProfile = "The Week-Long Silent Disappearance Tribunal";
    isAnjaliWinningRoll = false; // Reconciliation!
    judgeExpression = "sad";
  } else {
    judicialProfile = "Extreme Snuggle Hold Bail Commission";
    isAnjaliWinningRoll = false; // Rare mutual acquittals!
    judgeExpression = "happy";
  }

  // Pick facts dynamically from database
  const anjaliFacts = facts.filter(f => f.category === "anjali");
  const dhruvyaFacts = facts.filter(f => f.category === "dhruvya");
  const randomInsideJokes = facts.filter(f => f.category === "inside_joke" || f.category === "both");

  const chosenAnjaliFact = anjaliFacts.length > 0 
    ? anjaliFacts[Math.floor(Math.random() * anjaliFacts.length)].text
    : `Anjali (nicknamed ${aNick}) is Dhruvya's designated heart owner and supreme moody sweet little doll.`;
    
  const chosenDhruvyaFact = dhruvyaFacts.length > 0
    ? dhruvyaFacts[Math.floor(Math.random() * dhruvyaFacts.length)].text
    : `Dhruvya (nicknamed ${dNick}) is a dedicated coder dinosaur boy who lives to pamper her.`;

  const chosenJoke = randomInsideJokes.length > 0
    ? randomInsideJokes[Math.floor(Math.random() * randomInsideJokes.length)].text
    : `The couple plans to live in Dehradun where daily momo treats and snuggling schedule is mandatory.`;

  // Real-time analysis of statements
  const accusedTestimonyAnalysis = analyzeSpeech(accusedAnswer || "", accusedName, profile);
  const prosecutorTestimonyAnalysis = analyzeSpeech(prosecutorAnswer || "", prosecutorName, profile);

  const dialogues: DialogueNode[] = [
    {
      speaker: "Judge 🧑‍⚖️",
      text: `Order in the court! Let it be known that the Grand Relationship Tribunal is convened. Today we examine the grave indictment: "${mistakeTitle}"!`,
      expression: judgeExpression
    },
    {
      speaker: "Judge 🧑‍⚖️",
      text: `We are litigating this dispute under the strict guidelines of: "${judicialProfile}". Ground rules are established. Let us hear the arguments!`,
      expression: "normal"
    }
  ];

  // Dynamic presentation based on who is accused and what they declared
  if (isDhruvyaAccused) {
    dialogues.push({
      speaker: "Anjali 💖",
      text: prosecutorAnswer 
        ? `Your Honor, listen to how bad starting this was! I testified: "${prosecutorAnswer}". He operates like an absolute ${dNick}! 💅`
        : `Your Honor, Dhruvya (${dNick}) is super guilty of "${mistakeTitle}"! My sweet heart is completely pouting right now!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: accusedAnswer
        ? `Your Honor, regarding that... my official testimony was: "${accusedAnswer}". I am her dedicated sweet dinosaur! 🥺🦖`
        : `Your Honor! I am just a silly bondu dinosaur who loves her more than typing speeds. Look at my puppy eyes!`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The bench has calculated the testimonies. Speech analysis on Dhruvya's plea: "${accusedTestimonyAnalysis}". Anjali's prosecution stance: "${prosecutorTestimonyAnalysis}".`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Constitution Section: "${chosenDhruvyaFact}". Habit Database Reference: "${chosenAnjaliFact}". Daily ritual factor: "${dailyRit}".`,
      expression: "normal"
    });
  } else {
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: prosecutorAnswer
        ? `Your Honor, Anjali (${aNick}) did "${mistakeTitle}"! My heart was pouted and I explicitly argued: "${prosecutorAnswer}"!`
        : `Your Honor, Anjali (${aNick}) did "${mistakeTitle}" and my cozy dinosaur chest needs urgent cuddle refills directly!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: accusedAnswer
        ? `Your Honor! Regarding "${mistakeTitle}", here is what really occurred: "${accusedAnswer}". Plus, I am just a tiny cute baby, how can I be guilty? 🥺🎀`
        : `Your Honor! I am a sweet baby with a pure kind heart, and Dhruvya is a silly dinosaur over-reacting! Look at my adorable face!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Inquiries synthesized. Accused (Anjali) evaluation: "${accusedTestimonyAnalysis}". Prosecutor (Dhruvya) evaluation: "${prosecutorTestimonyAnalysis}".`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Precedent check: "${chosenAnjaliFact}". Inside Joke database entry: "${chosenJoke}". Sleeping Queen status: "${sleepingQ}".`,
      expression: "normal"
    });
  }

  // Cross-examination Dialogue depending on Judicial Mood Profile
  if (judicialProfile === "The Hungry Momo Overlord Magistrate") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Under this jurisdiction, delicious Momos at ${momoLoc} are a basic human right. Any failure to support or deliver Peach Mogu Mogu triggers high legal penalties!`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `See! The Judge knows Kalsang momos and peach Mogu Mogu are of state importance! Rest my case! 😋🥟`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `I will order Momos to her immediately! Or deliver infinite plates on our next date! 🦖💋`,
      expression: "happy"
    });
  } else if (judicialProfile === "The Dehradun Long Distance Warden") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Two years of long distance deserves a physical proximity certificate! Since Oct 10, 2024 (and Dehradun college cohabitation) is active, physical hand-holding schedules must be executed sequentially!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Absolutely! Dehradun is going to be our magic cuddle land soon where we will kiss everyday!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Yes! No more sleeping early or disappearing on call in Dehradun! 👩‍❤️‍👨`,
      expression: "happy"
    });
  } else if (judicialProfile === "The Sleepy Snoring Beauty Tribunal") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Sleeping before saying long sweet goodnights is labeled Sleepy Treason! Snoring is of high legal interest. We check: is ${sleepingQ} the sleepiest?`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Dhruvya stays awake gymming, coding or playing and then falls asleep directly when I demand sweet pampering! 😴😾`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `But I coding to build cozy futures, and when I sleep I dream of her! It is a beautiful dino cycle! 🥺🦖`,
      expression: "sad"
    });
  } else if (judicialProfile === "High Voltage Pouting Authority Docs") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `A severe surge of cute pouting voltage! The prosecutor's pouting meters have broken. Immediate emergency cheek pinches are required!`,
      expression: "angry"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `My pouting levels are high because he behaves like a bondu dinosaur! I need extreme pamper session!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Starting sweet cuddle sequence... 1, 2, 3! Please smile, my beautiful angel! 🦖💖`,
      expression: "happy"
    });
  } else if (judicialProfile === "The Reels-Overlord Delay Penalty Commission") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Delaying response times while active on Instagram sending reels is a severe infraction of Code 44! Let active screens be monitored!`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `But Your Honor, I was sending reels of fluffy puppies representing my cozy love!`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `No excuses! Send cute reels, but reply to my texts instantly first! 😾💅`,
      expression: "pout"
    });
  } else if (judicialProfile === "The Sweet Forehead Kiss Inspectors") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `A physical forensic audit of forehead kisses is declared. The court orders 10 instant virtual forehead kisses and cheek squeezes!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Mwah! Mwah! Mwah! Mwah! Mwah! Over-delivering kissey targets with dinosaur speed! 🦖💋`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Hehe, okay, my heart is warming up a little bit! Best boy when he listens. 🥰`,
      expression: "happy"
    });
  } else if (judicialProfile === "Sarcastic AI Error Code Logic Panel") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `SYSTEM ERROR: Sweetness coefficient dropped below critical levels. Re-booting relationship warmth module. Executing logic checks...`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Code compiled successfully! Warmth factors restored at 100% efficiency. 💻⚡`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Hmh, silly programmer boy! His heart logic makes me happy though. 🥺`,
      expression: "happy"
    });
  } else if (judicialProfile === "Litchi Mogu Mogu Sovereign Supreme Office") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Let it be known: Mogu Mogu (particularly Peach or Litchi flavor) heals 99.9% of all relationship arguments. The accused is ordered to pledge delicious drink bottles!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Yesss! A super cold Litchi Mogu Mogu to sip while we snuggle in Dehradun! 🥤🥰`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Pledged! I will stock a whole mini-fridge of Mogu Mogu drinks for my precious baby! 🦖🥂`,
      expression: "happy"
    });
  } else if (judicialProfile === "The Snapchat Exam Interrogation Council (Sept 28, 2024)") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Under historical Dehradun-Snapchat treaty bylaws of Sept 28, 2024: Dhruvya first found Anjali wandering on Snapdragon stranger search. Discovering she had a major exam the next morning, his nerdy studious brain shouted: 'WTF, tomorrow is your exam and what are you doing on Snapchat wasting your time?!'`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Guilty as charged, Your Honor! I was prepares for JEE exam and couldn't see this gorgeous smart commerce girl waste her time. But from the first day we met, it felt like we had already been together for lifetimes! ✨🦖`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `He was acting like a total strict teacher! But I loved his care. I messaged him right after my exam and he was already head over heels in love with me! 🤭🧸`,
      expression: "happy"
    });
  } else if (judicialProfile === "The October 10 Confession & Ghosting Precedent Jury") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `We cite October 10, 2024! Dhruvya stepped up and said: 'I don't wanna be your friend or anything... I think I am in love with you, be my girlfriend'. Accused Anjali tried to hesitation-ghost him, but failed because she also fell helplessly in love!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Hey, I only hesitated and ghosted him a little bit to maintain my cute queen status! 💅 But of course I said Yes. We became so close in just one month, sharing everything!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `I knew she was in love with me deep down! We shared our deepest feelings, dirty secrets, happy things, and even our first numbers. She's my future wife! 🦖💍`,
      expression: "happy"
    });
  } else if (judicialProfile === "The JEE vs Commerce Academic Supremacy Bench") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The Court is in deadlock. Dhruvya: JEE preparation studious math nerd who codes & gyms. Anjali: super smart Commerce Queen who operates balance sheets and controls mood fluctuations. Who yields relationship authority?`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Commerce rules! Every transaction must have an equal credit of double pampering, and Dhruvya is the primary asset I manage! 💖💸`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `My JEE calculus proves that Anjali's beauty holds infinite force of attraction, pulling me in forever! 📐🚀`,
      expression: "happy"
    });
  } else if (judicialProfile === "The Week-Long Silent Disappearance Tribunal") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `We recall the trial of the Lost Contact Week! After her exam, for some reason, they lost touch for a whole week. Who broke the digital ice?`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `I did, Your Honor! After 7 excruciating days, I texted my beautiful girl. I saw how cute she looked on Instagram, and we spoke for hours and hours and never stopped again! 👋🦖`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `And I am so glad my dinosaur boy messaged me! We shared our phone numbers and have been deeply, beautifully in love ever since! 🥺🔐`,
      expression: "happy"
    });
  } else {
    // Ultimate Babyhood Immunity, Double Cuddle, or Snuggle Hold
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The grand magistrates have concluded their emotional evaluations. Ready to issue the final decree.`,
      expression: "happy"
    });
  }

  // Cross-examination & Final verdict calculations
  let guiltyParty: "Anjali" | "Dhruvya" | "Both" | "None" = "Dhruvya";
  let winner: "Anjali" | "Dhruvya" | "None" = "Anjali";
  let anjaliScore = 0;
  let dhruvyaScore = 0;
  let verdictText = "";
  let punishmentText = "";

  if (isAnjaliWinningRoll) {
    anjaliScore = Math.floor(Math.random() * 15) + 85; // 85-99%
    dhruvyaScore = 100 - anjaliScore;
    winner = "Anjali";
    guiltyParty = "Dhruvya";

    if (isDhruvyaAccused) {
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `The Bench rules in absolute favor of Anjali (${aNick})! Dhruvya (${dNick}), you are found 100% guilty of relationship misdemeanor due to causing pouts, delays, or wait times!`,
        expression: "angry"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Victory! I knew my snuggly dinosaur would be convicted! Justice sits beautifully with a sweet queen! 👑🎉`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Yes, Your Honor, I happily surrender to my beautiful warden. I will serve my cuddle sentence with absolute joy! 🦖🥺`,
        expression: "sad"
      });

      // Randomized sentences with rich personalization!
      let sentences = [
        `Sentence: Dhruvya is commanded to send a 2-minute adorable voice note singing her favorite song, state 'Anjali is my cute queen' 5 times on call, and buy a double plate of momos at ${momoLoc}! 🥟`,
        `Sentence: Dhruvya's keyboard rights are bonded until he logs 10 sweet forehead kisses and writes a 200-word essay about why ${aNick} has the prettiest kind heart! 💌`,
        `Sentence: Dhruvya must immediately transfer 20 cute reels of puppies/kittens, schedule an instant cozy bedtime phone date, and cuddle her for 30 consecutive minutes in Dehradun!`
      ];

      if (judicialProfile.includes("Snapchat")) {
        sentences = [
          `Sentence: Dhruvya is ordered to log off Snapchat for 2 hours and dedicate that exact block of time to sending Anjali snuggly voice notes, declaring 'Anjali is my cute girl' 10 times! 🧸💖`,
          `Sentence: Dhruvya must compile a 300-word 'Official Study Guide' praising Anjali's clever math-commerce brains, ending with an order for double cheesy street momos!`
        ];
      } else if (judicialProfile.includes("October 10")) {
        sentences = [
          `Sentence: A complete romantic reenactment of the October 10, 2024 proposal must be performed by Dhruvya on their very next video call. Anjali retains the right to hesitate for 30 seconds before kissing her dinosaur! 💋💍`,
          `Sentence: Dhruvya must buy her sweet chocolates and write a heartfelt confession letter explaining exactly how he fell irrevocably in love back in Autumn 2024!`
        ];
      } else if (judicialProfile.includes("JEE vs Commerce")) {
        sentences = [
          `Sentence: Dhruvya must use his advanced JEE mathematical calculations to calculate the exact force of gravity of their hugs, and Anjali must audit their daily warmth charts to ensure 100% cuddle credits! 📊📐`,
          `Sentence: Dhruvya is sentenced to explain how physics cannot explain why Anjali has the absolute prettiest eyes in Dehradun, and buy her street snacks!`
        ];
      } else if (judicialProfile.includes("Silent Disappearance")) {
        sentences = [
          `Sentence: Dhruvya must spam her inbox with 50 sweet 'Goodmorning/I love you baby' cards to make up for the historical 7-day silent gap!`,
          `Sentence: Both are commanded to hold an immediate 1-hour late-night secret call discussing cheekiest dreams and naughty stuff from their first month of relationship! 💬🤭`
        ];
      }

      verdictText = `GUILTY OF EXTREME BONDUISM! Dhruvya (${dNick}) is convicted of "${mistakeTitle}" against his supreme moody angel.`;
      punishmentText = sentences[Math.floor(Math.random() * sentences.length)];
    } else {
      // Anjali committed the mistake, but gets Babyhood Immunity!
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `The evidence shows Anjali did "${mistakeTitle}", but she is explicitly designated 'just a baby' with sweet kind eyes. Under Section 7 of the Cute Baby Hood Immunity Pact, babies are 100% immune! Charges dismissed with hugs!`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Classic baby immunity loophole! She looks moody but adorable and gets acquitted every single time! This is a rig! 🦖😂`,
        expression: "shocked"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Hehe! Cuteness rules the universe, silly bondu boy! Now give me forehead kisses and take me to ${momoLoc}! 💋`,
        expression: "happy"
      });

      let babySentences = [
        `Sentence: Dhruvya's objections are overruled as sweet nonsense. Dhruvya is ordered to hug and pamper Anjali (` + aNick + `) for 5 minutes without complaining! 🧸`,
        `Sentence: Dhruvya must write a sweet Goodnight message expressing his absolute adoration, plus order a cold Peach Mogu Mogu for his moody princess!`,
        `Sentence: Dhruvya is sentenced to cuddle her tightly on their next physical date, agreeing that she is the prettiest baby ever!`
      ];

      if (judicialProfile.includes("Snapchat")) {
        babySentences = [
          `Sentence: Because of the Snapchat Exam Act, Anjali is declared 100% immune to JEE nerd rules. Dhruvya must pay a fine of 5 sweet forehead mwahs and say 'you were always my destiny'!`
        ];
      } else if (judicialProfile.includes("October 10")) {
        babySentences = [
          `Sentence: The October 10th Confession contract is reaffirmed. Dhruvya must send Anjali a sweet list of 10 reasons why he will never let her go, plus buy her momos! 🥟💞`
        ];
      }

      verdictText = `CHARGES DISMISSED VIA ABSOLUTE CUTE BABY IMMUNITY! Anjali (${aNick}) is declared 1000% innocent.`;
      punishmentText = babySentences[Math.floor(Math.random() * babySentences.length)];
    }
  } else {
    // Dhruvya wins / Mutual Cozy Sovereign Treaty (very rare and special outcome!)
    anjaliScore = 50;
    dhruvyaScore = 50;
    winner = "None";
    guiltyParty = "Both";

    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Under the joint Dehradun Cohabitation Accord, both parties are found highly guilty of loving each other way too much! All current arguments are instantly dissolved.`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Yay! Mutual peace and eternal cuddles! I love you endlessly, my sweet moody queen! 🦖💖`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Hehe, okay, you are sweet when we agree! I love you too, my cozy programmer dinosaur. Let's send cute reels! 🥺👩‍❤️‍👨`,
      expression: "happy"
    });

    verdictText = "MUTUAL ACQUITTAL VIA PURE ADORATION TRUCE! The court is happily dismissed.";
    punishmentText = `Sentence: Both Anjali and Dhruvya are sentenced to immediately sync sleep schedules, exit angry mood states, order some momos at ${momoLoc}, and schedule a cozy midnight video call session! 💋✨`;
  }

  return {
    mistakeTitle,
    accusedName,
    prosecutorName,
    dialogues,
    pointDistribution: {
      anjaliScore,
      dhruvyaScore,
      guiltyParty,
      winner
    },
    verdictText,
    punishmentText
  };
}
