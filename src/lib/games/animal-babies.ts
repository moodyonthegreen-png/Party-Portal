/**
 * Animal baby names, kept for their own game (taken out of baby trivia).
 * Same shape as trivia questions. Pure data, safe to import anywhere.
 */
import type { TriviaQuestion } from "./trivia-bank";

export const ANIMAL_BABIES: TriviaQuestion[] = [
  {
    id: "joey",
    q: "What's a baby kangaroo called?",
    options: ["A kit", "A joey", "A cub", "A pup"],
    answer: 1,
    fact: "A newborn joey is about the size of a jelly bean and crawls into its mother's pouch to grow.",
  },
  {
    id: "cygnet",
    q: "What's a baby swan called?",
    options: ["A cygnet", "A gosling", "A swanlet", "A fledge"],
    answer: 0,
    fact: "Cygnets are usually fluffy and gray. They turn white as they grow up.",
  },
  {
    id: "hoglet",
    q: "What's a baby hedgehog called?",
    options: ["A piglet", "A hoglet", "A spikelet", "A kit"],
    answer: 1,
    fact: "Hoglets are born with soft spines under their skin, which harden within a few hours.",
  },
  {
    id: "owlet",
    q: "What's a baby owl called?",
    options: ["An owlet", "A chick-a-hoo", "A fledgeling cub", "A hootlet"],
    answer: 0,
    fact: "Owlets often leave the nest before they can fly well and hop around on branches.",
  },
];
