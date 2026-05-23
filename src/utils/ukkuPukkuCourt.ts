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

/**
 * Generates a fully personalized courtroom hearing simulation.
 */
export function generateUkkuPukkuCourtTrial(
  mistakeTitle: string,
  loggedByName: string,
  loggedByUid: string,
  currentUserId: string,
  partnerName: string,
  facts: Fact[] = []
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
      text: `${prosecutorName} has accused ${accusedName} of this mistake. Let us hear the arguments!`,
      expression: "normal"
    }
  ];

  // Presentation of args
  if (isDhruvyaAccused) {
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Your Honor, Dhruvya is clearly guilty! He committed "${mistakeTitle}". This is completely unacceptable!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `But Your Honor! I apologize! I am totally dedicated to love, even if my brain was brief-circuited!`,
      expression: "sad"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `The defense pleads temporary distraction. Let us review the established relationship constitution rules.`,
      expression: "shocked"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT RECORD] Established Rule: ${chosenDhruvyaFact} Note also that: ${chosenAnjaliFact}`,
      expression: "normal"
    });
  } else {
    dialogues.push({
      speaker: "Dhruvya 🦖",
      text: `Your Honor, Anjali did "${mistakeTitle}" and I feel extremely pouted!`,
      expression: "pout"
    });
    dialogues.push({
      speaker: "Anjali 💖",
      text: `Your Honor! I am literally just a baby. How can a cute baby be held criminally liable?! Look at my face! 🥺`,
      expression: "happy"
    });
    dialogues.push({
      speaker: "Judge 🧑‍⚖️",
      text: `A compelling defense. Let us review the precedents of the Supreme Council.`,
      expression: "normal"
    });
    dialogues.push({
      speaker: "System 📜",
      text: `[COURT RECORD] Precedent state: ${chosenAnjaliFact} And: ${chosenJoke}`,
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
        text: `The court finds Dhruvya's arguments invalid. You cannot make excuses for making Anjali pout, young man!`,
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
      punishmentText = "Sentence: Dhruvya must apologize sweetly, send his partner lots of cute reels, and buy her a delicious treat immediately! ❤️";
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
      punishmentText = "Sentence: Dhruvya's counter-charges are dismissed. Dhruvya is commanded to hug Anjali for 60 seconds with full warmth! 🤗❤️";
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
      punishmentText = "Sentence: Anjali must deliver a sweet forehead kiss or a warm message to restore relationship peace! 💋";
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
      punishmentText = "Sentence: Anjali is sentenced to write a sweet message expressing how much she loves Dhruvya or hug him tightly! 🦕💖";
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
