/**
 * Baby animal names: guests type what each animal's baby is called.
 * Pure data, safe to import anywhere. Keep ids stable: saved guest answers
 * refer to them. `accepted[0]` is the answer shown to guests.
 */
export type AnimalQuestion = {
  id: string;
  animal: string;
  accepted: string[];
  fact?: string;
};

export const ANIMAL_BABIES: AnimalQuestion[] = [
  { id: "kangaroo", animal: "kangaroo", accepted: ["joey"], fact: "A newborn joey is about the size of a jelly bean and crawls into its mother's pouch to grow." },
  { id: "swan", animal: "swan", accepted: ["cygnet"], fact: "Cygnets are usually fluffy and gray. They turn white as they grow up." },
  { id: "hedgehog", animal: "hedgehog", accepted: ["hoglet"], fact: "Hoglets are born with soft spines that harden within a few hours." },
  { id: "owl", animal: "owl", accepted: ["owlet"], fact: "Owlets often leave the nest before they can fly well and hop around on branches." },
  { id: "goat", animal: "goat", accepted: ["kid"], fact: "That's where we get \"kid\" for a child!" },
  { id: "deer", animal: "deer", accepted: ["fawn"], fact: "A fawn's white spots help it hide in dappled sunlight on the forest floor." },
  { id: "goose", animal: "goose", accepted: ["gosling"] },
  { id: "horse", animal: "horse", accepted: ["foal", "colt", "filly"], fact: "Any baby horse is a foal. A young male is a colt and a young female is a filly." },
  { id: "sheep", animal: "sheep", accepted: ["lamb"] },
  { id: "pig", animal: "pig", accepted: ["piglet"] },
  { id: "bear", animal: "bear", accepted: ["cub"] },
  { id: "frog", animal: "frog", accepted: ["tadpole", "polliwog", "froglet"], fact: "Tadpoles breathe with gills and swim with a tail before they grow legs." },
  { id: "eagle", animal: "eagle", accepted: ["eaglet"] },
  { id: "duck", animal: "duck", accepted: ["duckling"] },
  { id: "hare", animal: "hare", accepted: ["leveret"], fact: "Unlike baby rabbits, leverets are born with fur and their eyes open." },
  { id: "turkey", animal: "turkey", accepted: ["poult"] },
  { id: "fish", animal: "fish", accepted: ["fry", "fingerling"], fact: "Newly hatched fish are fry. Once they're about the length of a finger they're called fingerlings." },
  { id: "koala", animal: "koala", accepted: ["joey"], fact: "Koalas are marsupials too, so their babies are joeys, just like kangaroos." },
  { id: "seal", animal: "seal", accepted: ["pup"] },
  { id: "elephant", animal: "elephant", accepted: ["calf"], fact: "A newborn elephant calf can weigh around 200 pounds." },
  { id: "giraffe", animal: "giraffe", accepted: ["calf"], fact: "Giraffe moms give birth standing up, so a calf's first moment is a drop of about 5 feet. It's usually on its feet within an hour." },
  { id: "rabbit", animal: "rabbit", accepted: ["kit", "kitten", "bunny"] },
  { id: "butterfly", animal: "butterfly", accepted: ["caterpillar", "larva"] },
  { id: "platypus", animal: "platypus", accepted: ["puggle"], fact: "Platypuses lay eggs, and the babies that hatch are called puggles." },
  { id: "llama", animal: "llama", accepted: ["cria"], fact: "Baby llamas and alpacas are both called crias." },
  { id: "pigeon", animal: "pigeon", accepted: ["squab", "squeaker"] },
  { id: "oyster", animal: "oyster", accepted: ["spat"], fact: "Baby oysters swim freely for a few weeks, then settle down and attach to a hard surface for life." },
  { id: "fox", animal: "fox", accepted: ["kit", "cub", "pup"] },
  { id: "lion", animal: "lion", accepted: ["cub"] },
  { id: "zebra", animal: "zebra", accepted: ["foal"] },
  { id: "spider", animal: "spider", accepted: ["spiderling"] },
  { id: "penguin", animal: "penguin", accepted: ["chick"] },
  { id: "whale", animal: "whale", accepted: ["calf"] },
  { id: "beaver", animal: "beaver", accepted: ["kit", "kitten", "pup"] },
];

export const ANIMAL_BY_ID = new Map(ANIMAL_BABIES.map((q) => [q.id, q]));

/** The host's chosen animals, in order, skipping any that aren't in the bank */
export function animalQuestions(ids: string[]): AnimalQuestion[] {
  return ids.map((id) => ANIMAL_BY_ID.get(id)).filter((q): q is AnimalQuestion => Boolean(q));
}

export const animalPrompt = (q: AnimalQuestion) => `What's a baby ${q.animal} called?`;
