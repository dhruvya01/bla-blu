export interface Fact {
  id: string;
  category: "anjali" | "dhruvya" | "both" | "inside_joke";
  text: string;
}

// NO hardcoded relationship facts. We will ask the user to provide their own data or add them inside the app.
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
 * Returns customized questions tailored to the specific mistake in the pair's long-distance life.
 */
export function getUkkuPukkuQuestions(
  mistakeTitle: string,
  accusedName: string,
  prosecutorName: string
): CourtQuestions {
  const titleLower = mistakeTitle.toLowerCase();
  
  if (titleLower.includes("reply") || titleLower.includes("phone") || titleLower.includes("massage") || titleLower.includes("message") || titleLower.includes("ignore") || titleLower.includes("chat")) {
    return {
      accused: `${accusedName}, we tracked a response latency in your server chat logs! Why were you sleeping/ignoring ${prosecutorName}'s adorable message? Were you distracted or sleepy?`,
      prosecutor: `${prosecutorName}, during this offline quiet period, how high did your cute pout level go? What standard response timeout do you demand under long-distance rules?`
    };
  }
  
  if (titleLower.includes("sleep") || titleLower.includes("awake") || titleLower.includes("asleep") || titleLower.includes("night") || titleLower.includes("morning")) {
    return {
      accused: `${accusedName}, sleep is sweet but saying sweet goodnights to your angel is a strict legal duty! Why did you crawl into premature dinosaur snoring hibernation early?`,
      prosecutor: `${prosecutorName}, how lonely did you feel without your boyfriend's pampering? What cuddle penalty should we sentence this snoozing cozy boy to?`
    };
  }

  if (titleLower.includes("kiss") || titleLower.includes("hug") || titleLower.includes("love") || titleLower.includes("cuddle") || titleLower.includes("care") || titleLower.includes("pout")) {
    return {
      accused: `${accusedName}, physical affection and pampering are absolute requirements under long-distance laws! Why have you failed to satisfy the sweet cuddle quotas today?`,
      prosecutor: `${prosecutorName}, state your exact love specifications. Should we mandate a strict 10-minute non-stop hug upon meeting together in Dehradun?`
    };
  }

  if (titleLower.includes("food") || titleLower.includes("eat") || titleLower.includes("momo") || titleLower.includes("treat") || titleLower.includes("drink") || titleLower.includes("mogu") || titleLower.includes("water") || titleLower.includes("dinner")) {
    return {
      accused: `${accusedName}, eating warm Momos or drinking peach Mogu Mogu without sending matching love bites to your partner is a culinary crime! How do you plead?`,
      prosecutor: `${prosecutorName}, what tasty treat reparations should this offender order for you to satisfy your sweet tooth completely?`
    };
  }

  if (titleLower.includes("angry") || titleLower.includes("fight") || titleLower.includes("mood") || titleLower.includes("rude") || titleLower.includes("attitude")) {
    return {
      accused: `${accusedName}, showing an attitude or a sudden moody temper over your kind-hearted sweet partner is supreme crime! What is your sincere baby defense?`,
      prosecutor: `${prosecutorName}, we know your soul is purely angelic, but outline how severely his/her temper hurt you. What pampering does your heart require?`
    };
  }

  // Fallback custom questions
  return {
    accused: `${accusedName}, you stand accused of relationship misdemeanor: "${mistakeTitle}". Explain your actions clearly on record. How will you fix this cute mess?`,
    prosecutor: `${prosecutorName}, tell the magistrates how pouted you became because of "${mistakeTitle}". What is your formal request for love restitution?`
  };
}

/**
 * Generates a fully personalized courtroom hearing simulation.
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

  // Roll a 100-sided die. Anjali wins 90% of the cases.
  const isAnjaliWinningRoll = Math.random() < 0.90; 
  
  // Pick facts from the facts array
  const anjaliFacts = facts.filter(f => f.category === "anjali");
  const dhruvyaFacts = facts.filter(f => f.category === "dhruvya");
  const randomInsideJokes = facts.filter(f => f.category === "inside_joke" || f.category === "both");

  const chosenAnjaliFact = anjaliFacts.length > 0 
    ? anjaliFacts[Math.floor(Math.random() * anjaliFacts.length)].text
    : "Anjali is 100% angelic and legally sweet.";
    
  const chosenDhruvyaFact = dhruvyaFacts.length > 0
    ? dhruvyaFacts[Math.floor(Math.random() * dhruvyaFacts.length)].text
    : "Dhruvya has committed to making Anjali happy at all costs.";

  const chosenJoke = randomInsideJokes.length > 0
    ? randomInsideJokes[Math.floor(Math.random() * randomInsideJokes.length)].text
    : "Cuddles are the key to relationship peace.";

  const dialogues: DialogueNode[] = [
    {
      speaker: "Judge 🧑‍⚖️",
      text: `Oyez, Oyez! The Honorable Ukku Pukku Relationship Court is now in session. Case: "${mistakeTitle}"!`,
      expression: "normal"
    },
    {
      speaker: "Judge 🧑‍⚖️",
      text: `Both partners have formally submitted their testimonies in writing! Let the grand hearings begin.`,
      expression: "normal"
    }
  ];

  // Presentation of args with actual entered arguments
  if (isDhruvyaAccused) {
    dialogues.push({
      speaker: "Anjali 💖",
      text: prosecutorAnswer 
        ? `Your Honor, Dhruvya is super guilty! For my testimony: "${prosecutorAnswer}"`
        : `Your Honor, Dhruvya is clearly guilty! He committed "${mistakeTitle}". This is completely unacceptable!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: accusedAnswer
        ? `But Your Honor! Under oath, here is my story: "${accusedAnswer}"`
        : `But Your Honor! I apologize! I am totally dedicated to love, even if my brain was brief-circuited!`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `Interesting. The prosecution complains: "${prosecutorAnswer || 'unacceptable behavior'}". The defense states: "${accusedAnswer || 'he of course promises to make it up'}". Let us review the established relationship law rules.`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Citing relationship rules: ${chosenDhruvyaFact} Note also: ${chosenAnjaliFact}`,
      expression: "normal"
    });
  } else {
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: prosecutorAnswer
        ? `Your Honor, Anjali did "${mistakeTitle}". In my statement: "${prosecutorAnswer}"! I feel neglected!`
        : `Your Honor, Anjali did "${mistakeTitle}" and I feel extremely pouted!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: accusedAnswer
        ? `Your Honor! Regarding that: "${accusedAnswer}". Plus, I am literally just a baby. Look at my face! 🥺`
        : `Your Honor! I am literally just a baby. How can a cute baby be held criminally liable?! Look at my face! 🥺`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The defense pleads 'just a baby'. Meanwhile, Dhruvya submits: "${prosecutorAnswer || 'feeling neglected'}". Let us examine relationship record archives.`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT LEGAL LOG] Verified Precedent: ${chosenAnjaliFact} Plus: ${chosenJoke}`,
      expression: "normal"
    });
  }

  // Cross-examination & Final verdict
  let guiltyParty: "Anjali" | "Dhruvya" | "Both" | "None" = "Dhruvya";
  let winner: "Anjali" | "Dhruvya" | "None" = "Anjali";
  let anjaliScore = 0;
  let dhruvyaScore = 0;
  let verdictText = "";
  let punishmentText = "";

  if (isAnjaliWinningRoll) {
    anjaliScore = 95;
    dhruvyaScore = 5;
    winner = "Anjali";
    guiltyParty = "Dhruvya";

    if (isDhruvyaAccused) {
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `The court finds Dhruvya's plea of "${accusedAnswer ? accusedAnswer.substring(0, 30) + '...' : 'being sleepy'}" completely invalid. You cannot make excuses for making Anjali pout, young man!`,
        expression: "angry"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Hmph! Exactly! Serves him right! 💅`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Aww ok... I surrender. Please have mercy, Your Honor! 🦖🥺`,
        expression: "sad"
      });

      verdictText = "GUILTY ON ALL CHARGES! Dhruvya is found guilty of making Anjali pout.";
      punishmentText = "Sentence: Dhruvya must apologize sweetly, send his partner lots of cute reels, and order her a delicious Momo or Mogu Mogu treat immediately! ❤️";
    } else {
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `Even though Anjali committed "${mistakeTitle}", the court notes she is registered as 'just a baby'. Babies cannot be prosecuted under the Cute Act!`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `What?! She got away with it again due to extreme cuteness?! 😱`,
        expression: "shocked"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Yay!! Cuteness is the law! Thank you, Your Honor! 🥰`,
        expression: "happy"
      });

      verdictText = "NOT GUILTY BY REASON OF CUTE BABYHOOD! Anjali is declared 100% innocent.";
      punishmentText = "Sentence: Dhruvya's counter-charges are dismissed. Dhruvya is commanded to hug Anjali for 60 seconds with full warmth when they meet in Dehradun! 🤗❤️";
    }
  } else {
    // Dhruvya wins (10% chance) - rare justice!
    anjaliScore = 20;
    dhruvyaScore = 80;
    winner = "Dhruvya";
    guiltyParty = "Anjali";

    if (isDhruvyaAccused) {
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `The court rules Dhruvya's actions are pardoned due to extreme efforts and dedication to his partner. Trial dismissed!`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Yes!! Thank you Your Honor! Finally a fair trial! 🎉`,
        expression: "happy"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `Fineee, I will let him off this time. He was pretty cute when apologizing. 🥺`,
        expression: "happy"
      });

      verdictText = "CHARGES CUDDLY DISMISSED! Dhruvya is acquitted.";
      punishmentText = "Sentence: Anjali must deliver a sweet forehead kiss or a custom message to restore relationship peace! 💋";
    } else {
      dialogues.push({
        speaker: "Judge 🧑‍⚖️",
        text: `Evidence shows Anjali indeed committed "${mistakeTitle}". Even cute babies must say sorry when a mistake occurs.`,
        expression: "normal"
      });
      dialogues.push({
        speaker: "Anjali 💖",
        text: `But... I am just a baby! Is that a crime?! 🥺`,
        expression: "pout"
      });
      dialogues.push({
        speaker: "Dhruvya 🦖",
        text: `Aha! The law applies, but a warm apology will heal my heart completely!`,
        expression: "happy"
      });

      verdictText = "GUILTY of CUTE SILENCE / ACTION! Anjali is gently ruled responsible.";
      punishmentText = "Sentence: Anjali is sentenced to write a sweet message explaining how much she loves Dhruvya or hug him tightly! 🦕💖";
    }
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
