export interface Fact {
  id: string;
  category: "anjali" | "dhruvya" | "both" | "inside_joke";
  text: string;
}

// Static fallback facts if database is reading or initializing
export const PERSONALIZED_RELATIONSHIP_FACTS: Fact[] = [];

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
 * from different inquiry angles to ensure a fresh experience.
 */
export function getUkkuPukkuQuestions(
  mistakeTitle: string,
  accusedName: string,
  prosecutorName: string
): CourtQuestions {
  const titleLower = mistakeTitle.toLowerCase();
  const seed = Math.random();

  // 1. REPLIES, CHAT, LATENCY, MESSAGES
  if (
    titleLower.includes("reply") || 
    titleLower.includes("phone") || 
    titleLower.includes("massage") || 
    titleLower.includes("message") || 
    titleLower.includes("ignore") || 
    titleLower.includes("chat") ||
    titleLower.includes("call")
  ) {
    if (seed < 0.33) {
      return {
        accused: `${accusedName}, the supreme satellites have recorded heavy delays in your chat transmission cycles! Why were you keeping ${prosecutorName} waiting for a sweet reply? Explain your activities!`,
        prosecutor: `${prosecutorName}, during this silent response lag, what was your exact state of mind? Did you prepare the ultimate angry pout, or did you browse reels in despair?`
      };
    } else if (seed < 0.66) {
      return {
        accused: `${accusedName}, explain why virtual screen time with ${prosecutorName} was briefly interrupted! Is there a logical explanation, or was your brain temporary shut down like a dusty laptop?`,
        prosecutor: `${prosecutorName}, how many times did you check your lock-screen for a notification? What is the official compensatory text message count you demand now?`
      };
    } else {
      return {
        accused: `${accusedName}, state your defense! Failing to answer a message from the sweetest angel instantly is a major offense in the Relationship Code. How do you defend your slower typing speeds?`,
        prosecutor: `${prosecutorName}, the floor is yours to express your heartbreak. Should we impose a mandatory 'immediate typing notification' policy on ${accusedName}'s phone?`
      };
    }
  }
  
  // 2. SLEEPING EARLY, SNORING, AWAKE SCHEDULES
  if (
    titleLower.includes("sleep") || 
    titleLower.includes("awake") || 
    titleLower.includes("asleep") || 
    titleLower.includes("night") || 
    titleLower.includes("morning") ||
    titleLower.includes("wake")
  ) {
    if (seed < 0.33) {
      return {
        accused: `${accusedName}, sleep schedule alert! Why did you initiate deep hibernation and forget to say your sweet goodnights? Who authorized this early snoozing?`,
        prosecutor: `${prosecutorName}, with ${accusedName} sleeping like a logs, how warm/cold was your night? How many hugs must be paid back to restore balance?`
      };
    } else if (seed < 0.66) {
      return {
        accused: `${accusedName}, is it true you sleep like a baby while ${prosecutorName} stays awake longing for your sweet pampering voice? Do you plead guilty to sleepy negligence?`,
        prosecutor: `${prosecutorName}, given that some boys sleep whole morning and stay up coding or singing, or vice-versa, what sleep schedule adjustment do you formally demand?`
      };
    } else {
      return {
        accused: `${accusedName}, sleep is natural, but slipping into dreams without delivering sweet forehead kisses and comforting words is illegal! What is your sleepy defense?`,
        prosecutor: `${prosecutorName}, did your cute partner snore too early or stay up too late gymming/coding? Specify the cuddling compensation schedule!`
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
        accused: `${accusedName}, your warmth coefficients have dropped below standard levels! Why has the daily quota of forehead kisses and sweet words been mildly neglected today?`,
        prosecutor: `${prosecutorName}, you deserve absolute royal pampering at all hours. How many virtual cheek squeezes did you miss, and how will you enforce payment?`
      };
    } else {
      return {
        accused: `${accusedName}, love and baby pampering are absolute constitutional requirements! Why have you failed to deliver maximum cute energy to your sweetheart?`,
        prosecutor: `${prosecutorName}, tell the Magistrates your dream cuddling scenario for when you meet physically in Dehradun. What are your exact demands?`
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
        accused: `${accusedName}, eating hot spicy Momos or drinking delicious Mogu Mogu without sending immediate love photos or planning a matching food delivery is a critical craving offense! How do you explain yourself?`,
        prosecutor: `${prosecutorName}, we know your soul lives on sweet treats and ultimate pamper. What level of delicious restitution should this court order for your sweet tooth?`
      };
    } else {
      return {
        accused: `${accusedName}, you are accused of delicious food hoarding / neglecting to pamper ${prosecutorName} with sweet treats! Why didn't you feed your baby some digital or real momos?`,
        prosecutor: `${prosecutorName}, do you require a court-ordered Peach/Litchi Mogu Mogu delivered immediately as emotional damages?`
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
        accused: `${accusedName}, getting angry or showing a moody attitude to your sweetheart is a massive misdemeanor! How do you defend this temporary surge in hot temper?`,
        prosecutor: `${prosecutorName}, despite your angelic kind-hearted soul, you were subjected to high-voltage moody behavior. What emotional compensation or cute apology letter do you request?`
      };
    } else {
      return {
        accused: `${accusedName}, we understand anxiety or exhaustion exists, but taking it out on your sweet precious partner is legally unacceptable! How do you offer to resolve the tension?`,
        prosecutor: `${prosecutorName}, did you receive the required number of sweet apologies yet? How will you heal your sweet, delicate kind heart?`
      };
    }
  }

  // 6. DEFAULT / FALLBACK
  if (seed < 0.33) {
    return {
      accused: `${accusedName}, you stand trial for relationship slip-up: "${mistakeTitle}". Speak clearly under oath — how are you going to apologize and pamper your sweet partner?`,
      prosecutor: `${prosecutorName}, state your case concisely! How much did this behavior make your sweet heart pout? What cute penalty should we issue?`
    };
  } else if (seed < 0.66) {
    return {
      accused: `${accusedName}, relationship alert! Your actions regarding "${mistakeTitle}" have caused a structural imbalance in sweet snuggly energy. How do you defend your silly brain?`,
      prosecutor: `${prosecutorName}, the court is prepared to rule in your favor. What sweet chores, treat delivery, or kissing sequence should this boy/girl perform?`
    };
  } else {
    return {
      accused: `${accusedName}, your trial has commenced! What is your immediate explanation for this silly move? We demand a highly creative, sweet defense!`,
      prosecutor: `${prosecutorName}, please testify. On a scale of 1 to 100, how much pampering does your heart require right now to forgive this crime?`
    };
  }
}

/**
 * Helper function to parse user answers in real-time and return funny reactive judicial commentary.
 */
function analyzeSpeech(speechText: string, speakerName: string): string {
  const lower = speechText.toLowerCase();
  if (!speechText || speechText.trim().length === 0) {
    return `[The subject remained affectionately silent or pouted cutely under examination]`;
  }

  const reactions: string[] = [];
  
  if (lower.includes("sorry") || lower.includes("apologize") || lower.includes("maaf") || lower.includes("galti")) {
    reactions.push(`The court deeply notes that ${speakerName} displays true repentance and a warm, loving soul by apologizing.`);
  }
  if (lower.includes("baby") || lower.includes("baccha") || lower.includes("cute") || lower.includes("pout")) {
    reactions.push(`The defendant explicitly tries to weaponize the 'just a baby' legal defense to bypass prosecutorial action!`);
  }
  if (lower.includes("love") || lower.includes("pyar") || lower.includes("cuddle") || lower.includes("hug")) {
    reactions.push(`The witness claims an abundance of pure cuddly affection, which may act as emotional bail.`);
  }
  if (lower.includes("momo") || lower.includes("eat") || lower.includes("mogu")) {
    reactions.push(`Culinary references detected! The court's mouth is watering over Momos and Mogu Mogu drinks.`);
  }
  if (lower.includes("dehradun") || lower.includes("college") || lower.includes("meet") || lower.includes("october")) {
    reactions.push(`This references their historic Dehradun reunion schedules, which automatically multiplies sweet coefficients.`);
  }
  if (lower.includes("gym") || lower.includes("coding") || lower.includes("sing") || lower.includes("busy")) {
    reactions.push(`The witness cites high-intensity physical, logical, or artistic hobbies to excuse response delay.`);
  }

  if (reactions.length === 0) {
    reactions.push(`The statement is recognized as: "${speechText.substring(0, 50)}${speechText.length > 50 ? '...' : ''}", displaying a highly passionate perspective!`);
  }

  return reactions.join(" ");
}

/**
 * Generates a fully personalized courtroom hearing simulation with rich dynamic paths.
 */
export function generateUkkuPukkuCourtTrial(
  mistakeTitle: string,
  loggedByName: string,
  loggedByUid: string,
  currentUserId: string,
  partnerName: string,
  facts: Fact[] = [],
  accusedAnswer?: string,
  prosecutorAnswer?: string
): CourtTrial {
  const isDhruvyaAccused = loggedByName.toLowerCase().includes("anjali") === false;
  
  const accusedName = isDhruvyaAccused ? "Dhruvya" : "Anjali";
  const prosecutorName = isDhruvyaAccused ? "Anjali" : "Dhruvya";

  // Roll a highly-varied dice to select one of 6 Judicial Moods/Opinions
  // Anjali still holds an 85% default success rate due to divine baby supremacy, but the paths vary wildly!
  const judicialMoodSeed = Math.random();
  let judicialProfile = "Standard Sweet cuddly litigation";
  let isAnjaliWinningRoll = true;

  if (judicialMoodSeed < 0.20) {
    // Mood A: The Momo Craving Supreme Treaty (Anjali Win)
    judicialProfile = "Momo Craving Treaty";
    isAnjaliWinningRoll = true;
  } else if (judicialMoodSeed < 0.40) {
    // Mood B: The Dehradun College Long Distance Reunion Act (Anjali Win)
    judicialProfile = "Dehradun College Reunion Act";
    isAnjaliWinningRoll = true;
  } else if (judicialMoodSeed < 0.60) {
    // Mood C: Anjali's Ultimate Babyhood Absolute Immunity Clause (Anjali Win)
    judicialProfile = "Absolute Babyhood Immunity";
    isAnjaliWinningRoll = true;
  } else if (judicialMoodSeed < 0.75) {
    // Mood D: Moody Fights vs Kind Hearts Conflict Resolution (Anjali Win)
    judicialProfile = "Kind Hearts Soft Temper Resolution";
    isAnjaliWinningRoll = true;
  } else if (judicialMoodSeed < 0.90) {
    // Mood E: Dhruvya's Snoring Snuggle Snooze schedule (Anjali Win)
    judicialProfile = "Dinosaur Snoring Hibernate Schedule";
    isAnjaliWinningRoll = true;
  } else {
    // Mood F: Double Cuddle Acquittal & Mutual Pamper Treaty (Dhruvya gets pardoned / rare 15% victory of love!)
    judicialProfile = "Double Cuddle Mutual Treaty";
    isAnjaliWinningRoll = false;
  }

  // Pick facts dynamically from the facts database
  const anjaliFacts = facts.filter(f => f.category === "anjali");
  const dhruvyaFacts = facts.filter(f => f.category === "dhruvya");
  const randomInsideJokes = facts.filter(f => f.category === "inside_joke" || f.category === "both");

  const chosenAnjaliFact = anjaliFacts.length > 0 
    ? anjaliFacts[Math.floor(Math.random() * anjaliFacts.length)].text
    : "Anjali is Dhruvya's sweet little baby who is moody but an absolute doll.";
    
  const chosenDhruvyaFact = dhruvyaFacts.length > 0
    ? dhruvyaFacts[Math.floor(Math.random() * dhruvyaFacts.length)].text
    : "Dhruvya is a sweet bondu boy who loves Anjali more than himself.";

  const chosenJoke = randomInsideJokes.length > 0
    ? randomInsideJokes[Math.floor(Math.random() * randomInsideJokes.length)].text
    : "They are going to live in Dehradun soon and snuggle every single day!";

  // Real-time analysis of entered testimonies
  const accusedTestimonyAnalysis = analyzeSpeech(accusedAnswer || "", accusedName);
  const prosecutorTestimonyAnalysis = analyzeSpeech(prosecutorAnswer || "", prosecutorName);

  const dialogues: DialogueNode[] = [
    {
      speaker: "Judge 🧑‍⚖️",
      text: `Oyez, Oyez! The Supreme Magical Relationship Court of Cuteness is in high session. Today's Case Code: "${mistakeTitle}"!`,
      expression: "normal"
    },
    {
      speaker: "Judge 🧑‍⚖️",
      text: `We are administering trials under the Judicial Profile: "${judicialProfile}". Ground rules are set! Both live testimonies logged.`,
      expression: "normal"
    }
  ];

  // Dynamic presentation based on who is accused and what they answered
  if (isDhruvyaAccused) {
    dialogues.push({
      speaker: "Anjali 💖",
      text: prosecutorAnswer 
        ? `Your Honor, listen to how bad starting this was! I testified: "${prosecutorAnswer}". He must be punished cute-ly! 💅`
        : `Your Honor, Dhruvya is super guilty of "${mistakeTitle}"! This behaves like an absolute bondu!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: accusedAnswer
        ? `Your Honor, I completely apologize! My official defense was: "${accusedAnswer}". I am literally dedicated to her! 🦖🥺`
        : `Your Honor! I am just a stupid dinosaur boy who got brief-circuited! I love her endlessly!`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The Court has synthesized the claims. Analysis of Dhruvya's speech: "${accusedTestimonyAnalysis}". Analysis of Anjali's claims: "${prosecutorTestimonyAnalysis}".`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Constitutional Reference A: "${chosenDhruvyaFact}". Reference B: "${chosenAnjaliFact}".`,
      expression: "normal"
    });
  } else {
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: prosecutorAnswer
        ? `Your Honor, Anjali did "${mistakeTitle}"! My heart was pouted because: "${prosecutorAnswer}"!`
        : `Your Honor, Anjali did "${mistakeTitle}" and my heart is completely empty / needs urgent snuggle refills!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: accusedAnswer
        ? `Your Honor! Regarding "${mistakeTitle}", here is what really happened: "${accusedAnswer}". Also, how can you fine a sweet moody doll? 🥺`
        : `Your Honor! I did nothing wrong, I am literally just a precious little baby with a sweet, kind heart. Look at my eyes!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Testimony parsing completed. Accused (Anjali) evaluation: "${accusedTestimonyAnalysis}". Prosecutor (Dhruvya) evaluation: "${prosecutorTestimonyAnalysis}".`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Archival Relationship Precedent: "${chosenAnjaliFact}". Historical Inside Reference: "${chosenJoke}".`,
      expression: "normal"
    });
  }

  // Cross-examination Dialogue dependent on Judicial Mood Profile
  if (judicialProfile === "Momo Craving Treaty") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The grand court recognizes that Momos and peach Mogu Mogu drinks are basic human rights for Anjali! Any disruption is a catastrophic threat to relationship safety!`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Hah! See! Momos are essential! I rest my case! 🥰😋`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `I will buy her infinite Momos and Mogu Mogu! I promise, Your Honor! 🥟🥤`,
      expression: "happy"
    });
  } else if (judicialProfile === "Dehradun College Reunion Act") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Considering they have conquered 2 years of long distance and are first-meeting on Oct 10, 2024, and now moving to Dehradun together, physical proximity requirements are absolute!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Dehradun college life is going to be so amazing! We are going to meet and snuggle every day! 👩‍❤️‍👨`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Yesss! No more long distance spacing excuses soon! We'll eat Momos together daily!`,
      expression: "happy"
    });
  } else if (judicialProfile === "Dinosaur Snoring Hibernate Schedule") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `A severe sleeping schedule conflict is highlighted! One party sleeps all night long, while the other wakes up all night to code & sing! SNORING IS NOT AN EXCUSE.`,
      expression: "angry"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Exactly! He stays awake gymming, coding or playing and then falls asleep when I want pampering! 😴😾`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `But sleep cozy cuddle logic is complex! I always want to stay awake and pamper her forever! 🥺🦖`,
      expression: "sad"
    });
  } else if (judicialProfile === "Kind Hearts Soft Temper Resolution") {
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Analyzing emotions. Anjali has high-intensity temper/moods but is a sweet doll, while Dhruvya is prone to anxiety and demands 100% constant love. Mutual soft hand-holding is ordered!`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `I can't help being moody, but I love him more than anyone can ever imagine! 💕🥺`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `And I will always pamper her through all of her mood swings, forever! 🥰🦖`,
      expression: "happy"
    });
  } else {
    // Ultimate Babyhood Absolute Immunity or Cuddle Mutual Treaty
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The Court is preparing the final ultimate measurements of relationship safety. Cuteness ratios are extreme.`,
      expression: "shocked"
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
        text: `The Bench rules in favor of Anjali! Dhruvya, you have been found 100% guilty of relationship misdemeanor due to making your moody little sweet doll pout or wait!`,
        expression: "angry"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Hmph! I knew it! Justice has been beautifully served! 💅🎉`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Aww, yes Your Honor, I gratefully accept my sentence. I am her happy captive of love! 🦖🤗`,
        expression: "sad"
      });

      // Randomized sentences for extra funny variety!
      const sentences = [
        "Sentence: Dhruvya is commanded to apologize instantly, send 10 adorable Instagram reels, and sponsor a double plate of Momos with Peach Mogu Mogu! 🥟🥤",
        "Sentence: Dhruvya must record a cute voice note singing her favorite song, state 'Anjali is my queen' 3 times, and pamper her with ultimate attention!",
        "Sentence: Dhruvya's keyboard privileges are partially restricted until he delivers a written declaration of cuddle adoration, plus a 10-minute snuggle upon meeting in Dehradun! 🗺️"
      ];
      verdictText = `GUILTY ON ALL CHARGES! Dhruvya is found guilty of "${mistakeTitle}" against his sweet little angel.`;
      punishmentText = sentences[Math.floor(Math.random() * sentences.length)];
    } else {
      // Anjali committed the mistake, but gets Babyhood Immunity!
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `Even though Anjali indeed did "${mistakeTitle}", the court confirms she is legally designated 'just a baby'. Under Section 7 of the Cute Baby Treaty, babies are completely immune to prosecution! Charges dismissed!`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `What?! She got away with it again just by looking cute and moody?! This is cute rigging! 😱🦕`,
        expression: "shocked"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Yayayay! Cuteness is the supreme law! Hug me now, stupid bondu boy! 🥰`,
        expression: "happy"
      });

      const babySentences = [
        "Sentence: Dhruvya's counter-claims are ruled sweet nonsense. Dhruvya is sentenced to cuddle Anjali for 5 full minutes without talking!",
        "Sentence: Dhruvya must deliver 5 virtual forehead kisses and write a long sweet message telling her she is the prettiest angel in the universe! 💖",
        "Sentence: Dhruvya is ordered to draft a formal apology for ever doubting her baby innocence, and send her a sweet gift!"
      ];
      verdictText = `NOT GUILTY BY REASON OF SUPREME CUTE BABYHOOD! Anjali is declared 100% innocent of "${mistakeTitle}".`;
      punishmentText = babySentences[Math.floor(Math.random() * babySentences.length)];
    }
  } else {
    // Dhruvya wins / Mutual Cuddle Agreement (15% chance - very special, highly satisfying outcome!)
    anjaliScore = 50;
    dhruvyaScore = 50;
    winner = "None";
    guiltyParty = "Both";

    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Under the Dehradun Unified Peace Treaty, both parties are declared highly guilty of loving each other way too much! Local disputes are completely dissolved!`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Yay! Mutual absolute defeat and victory! I love you so much, my sweet queen! 🦖💖`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Fine, let's stop fighting and cuddle! You are pretty sweet when we agree! 🥰👩‍❤️‍👨`,
      expression: "happy"
    });

    verdictText = "MUTUAL ACQUITTAL VIA PURE RELATIONSHIP ADORATION! Court is dismissed.";
    punishmentText = "Sentence: Both Anjali and Dhruvya are commanded to sync their schedules, stop being anxious or angry, download some funny reels, and schedule a cozy video call date immediately! 💋❤️";
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
