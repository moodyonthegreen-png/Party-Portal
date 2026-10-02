/**
 * Baby trivia: the built-in question bank. Pure data, safe to import anywhere.
 * `answer` is the index of the right option. Keep ids stable: saved guest
 * answers refer to them.
 */
export type TriviaQuestion = {
  id: string;
  q: string;
  options: string[];
  answer: number;
  /** Shown after answering */
  fact: string;
};

export const TRIVIA_BANK: TriviaQuestion[] = [
  {
    id: "bones",
    q: "About how many bones is a newborn baby born with?",
    options: ["206", "About 300", "About 150", "About 450"],
    answer: 1,
    fact: "Babies start out with around 300 bones and cartilage pieces. Many fuse together as they grow, leaving adults with 206.",
  },
  {
    id: "kneecaps",
    q: "Babies are born without bony…",
    options: ["Kneecaps", "Toes", "Ribs", "Fingers"],
    answer: 0,
    fact: "Newborn kneecaps are soft cartilage. They slowly harden into bone over the first few years.",
  },
  {
    id: "see-distance",
    q: "About how far can a newborn see clearly?",
    options: ["1 to 2 inches", "8 to 12 inches", "About 3 feet", "Across the room"],
    answer: 1,
    fact: "That's roughly the distance to a parent's face while feeding, which is just what a newborn wants to look at.",
  },
  {
    id: "first-color",
    q: "Which color are babies thought to pick out first?",
    options: ["Blue", "Yellow", "Red", "Green"],
    answer: 2,
    fact: "Newborns see bold black-and-white contrast best, and red is usually the first color they can tell apart.",
  },
  {
    id: "sleep",
    q: "How many hours a day does a newborn usually sleep?",
    options: ["8 to 10", "11 to 13", "14 to 17", "20 to 22"],
    answer: 2,
    fact: "Newborns sleep 14 to 17 hours a day, just in short stretches of a few hours at a time.",
  },
  {
    id: "soft-spot",
    q: "What's the soft spot on a baby's head called?",
    options: ["Fontanelle", "Clavicle", "Cowlick", "Crown"],
    answer: 0,
    fact: "The fontanelles let the skull squeeze through the birth canal and make room for a fast-growing brain.",
  },
  {
    id: "stomach",
    q: "On day one, a newborn's stomach is about the size of a…",
    options: ["Cherry", "Egg", "Tennis ball", "Grapefruit"],
    answer: 0,
    fact: "That's why newborns eat tiny amounts so often. Their stomachs grow quickly over the first weeks.",
  },
  {
    id: "first-tooth-age",
    q: "Around what age do most babies get their first tooth?",
    options: ["1 month", "6 months", "12 months", "18 months"],
    answer: 1,
    fact: "Most babies get their first tooth around 6 months, though anywhere from 4 to 12 months is normal.",
  },
  {
    id: "first-tooth",
    q: "Which teeth usually come in first?",
    options: ["Top molars", "Bottom front teeth", "Top canines", "Bottom molars"],
    answer: 1,
    fact: "The two bottom front teeth (lower central incisors) usually lead the way.",
  },
  {
    id: "double-weight",
    q: "Babies usually double their birth weight by about…",
    options: ["6 weeks", "5 months", "1 year", "2 years"],
    answer: 1,
    fact: "Most babies double their birth weight by around 5 months and triple it by their first birthday.",
  },
  {
    id: "length",
    q: "About how long is a typical full-term newborn?",
    options: ["12 inches", "20 inches", "26 inches", "30 inches"],
    answer: 1,
    fact: "Most full-term babies measure about 19 to 21 inches long.",
  },
  {
    id: "weight",
    q: "What's the average birth weight of a baby in the U.S.?",
    options: ["About 5 pounds", "About 7 pounds", "About 10 pounds", "About 12 pounds"],
    answer: 1,
    fact: "The average is a little over 7 pounds, and anywhere from about 5½ to 9 pounds is common.",
  },
  {
    id: "full-term",
    q: "A full-term pregnancy is how many weeks?",
    options: ["30 to 32", "35 to 36", "39 to 40", "44 to 45"],
    answer: 2,
    fact: "Doctors call 39 weeks through 40 weeks and 6 days \"full term.\"",
  },
  {
    id: "due-date",
    q: "About what share of babies arrive on their due date?",
    options: ["About 4%", "About 25%", "About 50%", "About 75%"],
    answer: 0,
    fact: "Only around 1 in 25 babies arrives right on the due date. Most come within a week or two either side.",
  },
  {
    id: "moro",
    q: "When startled, babies fling their arms out and pull them back in. What's this called?",
    options: ["The rooting reflex", "The Moro reflex", "The grasp reflex", "The hiccup reflex"],
    answer: 1,
    fact: "The Moro (startle) reflex usually fades by around 4 to 6 months.",
  },
  {
    id: "rooting",
    q: "Stroke a newborn's cheek and they turn toward it, ready to feed. What's that reflex?",
    options: ["Rooting", "Stepping", "Moro", "Babinski"],
    answer: 0,
    fact: "The rooting reflex helps newborns find the breast or bottle.",
  },
  {
    id: "mom-voice",
    q: "When can babies first recognize their mother's voice?",
    options: ["At birth", "At 3 months", "At 6 months", "At 1 year"],
    answer: 0,
    fact: "Babies hear in the womb during the last months of pregnancy, so they know Mom's voice from day one.",
  },
  {
    id: "vernix",
    q: "What's the white, waxy coating some babies are born with?",
    options: ["Lanugo", "Vernix", "Meconium", "Colostrum"],
    answer: 1,
    fact: "Vernix protects a baby's skin in the womb and works as a natural moisturizer after birth.",
  },
  {
    id: "lanugo",
    q: "What's the fine, soft hair that covers some newborns?",
    options: ["Lanugo", "Vellus", "Fuzzette", "Vernix"],
    answer: 0,
    fact: "Lanugo grows in the womb and usually falls out within the first few weeks.",
  },
  {
    id: "meconium",
    q: "What's a baby's very first poop called?",
    options: ["Colostrum", "Meconium", "Vernix", "Bilirubin"],
    answer: 1,
    fact: "Meconium is dark and sticky, made of everything the baby swallowed in the womb.",
  },
  {
    id: "colostrum",
    q: "What's the name of the first milk a mother makes?",
    options: ["Colostrum", "Foremilk", "Lactose", "Meconium"],
    answer: 0,
    fact: "Colostrum is thick, golden and packed with antibodies. It's sometimes called \"liquid gold.\"",
  },
  {
    id: "crawl",
    q: "Around what age do most babies start crawling?",
    options: ["2 months", "6 to 10 months", "14 to 16 months", "2 years"],
    answer: 1,
    fact: "Most babies crawl somewhere between 6 and 10 months, and some skip crawling altogether.",
  },
  {
    id: "walk",
    q: "Around what age do most babies take their first steps?",
    options: ["6 months", "Around 12 months", "18 to 24 months", "3 years"],
    answer: 1,
    fact: "First steps usually come around the first birthday, anywhere from about 9 to 18 months.",
  },
  {
    id: "heart-rate",
    q: "About how fast does a newborn's heart beat?",
    options: ["60 to 80 beats a minute", "120 to 160 beats a minute", "200 to 240 beats a minute", "30 to 50 beats a minute"],
    answer: 1,
    fact: "A newborn's heart beats roughly twice as fast as an adult's.",
  },
  {
    id: "back-to-sleep",
    q: "What's the safest way to lay a baby down to sleep?",
    options: ["On their tummy", "On their side", "On their back", "Propped on a pillow"],
    answer: 2,
    fact: "\"Back to sleep\": on their back, on a firm, flat surface with nothing else in the crib.",
  },
  {
    id: "brain",
    q: "At birth, a baby's brain is about what fraction of its adult size?",
    options: ["A tenth", "A quarter", "Half", "Almost all of it"],
    answer: 1,
    fact: "A baby's brain is about a quarter of adult size at birth and roughly doubles in the first year.",
  },
  {
    id: "diapers",
    q: "About how many diapers does a newborn go through in a day?",
    options: ["2 to 3", "8 to 12", "20 to 25", "Around 40"],
    answer: 1,
    fact: "That adds up to well over 2,000 diapers in the first year.",
  },
  {
    id: "kangaroo-care",
    q: "Holding a baby skin-to-skin on your chest is often called…",
    options: ["Koala care", "Kangaroo care", "Cuddle cocooning", "Penguin care"],
    answer: 1,
    fact: "Kangaroo care helps babies stay warm, steadies their breathing and heartbeat, and helps with feeding.",
  },
  {
    id: "nose-breathers",
    q: "Newborns breathe mostly through their…",
    options: ["Mouth", "Nose", "Both equally", "Ears"],
    answer: 1,
    fact: "Newborns are mostly nose breathers, which is why a stuffy nose bothers them so much.",
  },
  {
    id: "identical-twins",
    q: "Identical twins come from…",
    options: ["Two eggs", "One egg that splits", "Two eggs that merge", "Three eggs"],
    answer: 1,
    fact: "Identical twins start as one fertilized egg that splits in two. Fraternal twins come from two separate eggs.",
  },
  {
    id: "top-boy-name",
    q: "Which name has topped the U.S. list of baby boy names every year since 2017?",
    options: ["Noah", "Liam", "Oliver", "James"],
    answer: 1,
    fact: "Liam took the top spot from Noah in 2017 and has held it since, according to Social Security records.",
  },
  {
    id: "top-girl-name",
    q: "Which name has been the most popular U.S. baby girl name since 2019?",
    options: ["Emma", "Olivia", "Charlotte", "Amelia"],
    answer: 1,
    fact: "Olivia took over from Emma in 2019, according to Social Security records.",
  },
];

export const TRIVIA_BY_ID = new Map(TRIVIA_BANK.map((q) => [q.id, q]));

/** The host's chosen questions, in order, skipping any that aren't in the bank */
export function triviaQuestions(ids: string[]): TriviaQuestion[] {
  return ids.map((id) => TRIVIA_BY_ID.get(id)).filter((q): q is TriviaQuestion => Boolean(q));
}
