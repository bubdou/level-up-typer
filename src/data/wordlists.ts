// Practice content for M1. Lowercase letters and spaces only.
// Sources (see the About section in Settings):
// - Letter pairs: Peter Norvig, "English Letter Frequency Counts: Mayzner Revisited"
//   (Google Books Ngram counts), top 30 bigrams in rank order.
// - Short chunks: top 20 trigrams from counts over 9,481 Project Gutenberg books,
//   plus common word endings we picked ourselves.
// - Common words / More words: the Dolch sight word lists (Dolch, 1936).
//   Common = pre-primer, primer and first grade. More = second grade, third grade and nouns.
//   Words with capitals or apostrophes (I, don't, Christmas, Santa Claus) are left out.
//   Order inside each list is roughly by how often the word appears in English, so the
//   first batches hold the words a learner meets most.
// - Phrases and sentences: written by us, using only the words above.

export const LETTER_PAIRS = [
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
  'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
  'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le',
];

export const SHORT_CHUNKS = [
  // top 20 trigrams
  'the', 'and', 'ing', 'her', 'hat', 'his', 'tha', 'ere', 'for', 'ent',
  'ion', 'ter', 'was', 'you', 'ith', 'ver', 'all', 'wit', 'thi', 'tio',
  // common endings
  'ed', 'ly', 'est', 'ight', 'ould', 'ful', 'ment', 'less', 'ness', 'tion',
  'ous', 'ack', 'ake', 'ell', 'own',
];

export const COMMON_WORDS = [
  'the', 'and', 'a', 'to', 'in', 'is', 'it', 'you', 'of', 'that',
  'he', 'was', 'for', 'on', 'are', 'with', 'they', 'at', 'be', 'this',
  'have', 'from', 'by', 'one', 'had', 'but', 'what', 'all', 'were', 'we',
  'when', 'there', 'can', 'an', 'said', 'she', 'do', 'will', 'up', 'out',
  'them', 'then', 'her', 'him', 'his', 'so', 'some', 'has', 'my', 'me',
  'make', 'like', 'could', 'into', 'how', 'now', 'see', 'look', 'no', 'two',
  'go', 'come', 'did', 'get', 'our', 'over', 'down', 'just', 'know', 'may',
  'after', 'new', 'take', 'think', 'where', 'well', 'must', 'too', 'here', 'who',
  'say', 'give', 'find', 'ask', 'let', 'play', 'any', 'little', 'put', 'help',
  'good', 'every', 'three', 'once', 'old', 'again', 'went', 'came', 'live', 'under',
  'saw', 'want', 'as', 'round', 'open', 'red', 'ran', 'run', 'four', 'big',
  'eat', 'white', 'black', 'brown', 'blue', 'yellow', 'away', 'going', 'soon', 'please',
  'pretty', 'yes', 'thank', 'ride', 'stop', 'walk', 'jump', 'fly', 'funny', 'ate',
  'am', 'not',
];

export const MORE_WORDS = [
  'or', 'which', 'their', 'if', 'would', 'about', 'your', 'these', 'many', 'its',
  'been', 'only', 'made', 'use', 'very', 'first', 'day', 'way', 'time', 'back',
  'found', 'long', 'before', 'because', 'right', 'man', 'men', 'work', 'us', 'both',
  'those', 'why', 'much', 'never', 'own', 'show', 'small', 'home', 'house', 'water',
  'thing', 'name', 'school', 'night', 'off', 'always', 'around', 'best', 'call', 'does',
  'five', 'gave', 'goes', 'read', 'tell', 'upon', 'write', 'better', 'bring', 'done',
  'far', 'full', 'got', 'hold', 'keep', 'kind', 'light', 'myself', 'start', 'today',
  'together', 'try', 'father', 'mother', 'hand', 'head', 'eye', 'feet', 'door', 'children',
  'boy', 'girl', 'morning', 'money', 'paper', 'letter', 'table', 'tree', 'street', 'ground',
  'fire', 'sun', 'wind', 'rain', 'snow', 'fast', 'cold', 'hot', 'warm',
  'green', 'buy', 'pull', 'sing', 'sit', 'sleep', 'wash', 'wish', 'carry',
  'clean', 'cut', 'draw', 'drink', 'eight', 'fall', 'grow', 'hurt', 'laugh', 'pick',
  'seven', 'shall', 'six', 'ten', 'brother', 'sister', 'baby', 'dog', 'cat', 'bird',
  'fish', 'horse', 'cow', 'pig', 'sheep', 'duck', 'chicken', 'rabbit', 'bear', 'robin',
  'squirrel', 'kitty', 'apple', 'bread', 'cake', 'milk', 'egg', 'corn', 'seed', 'ball',
  'doll', 'toy', 'game', 'boat', 'car', 'box', 'bed', 'bell', 'chair', 'coat',
  'shoe', 'ring', 'stick', 'watch', 'window', 'floor', 'garden', 'flower', 'grass', 'hill',
  'farm', 'farmer', 'nest', 'wood', 'song', 'party', 'picture', 'birthday', 'goodbye', 'leg',
  'top',
];

export const PHRASES = [
  'of the', 'in the', 'to the', 'on the', 'and the', 'at the', 'for the', 'with the', 'it is', 'is it',
  'to be', 'in a', 'for you', 'from the', 'by the', 'at a', 'one of', 'all of', 'this is', 'that is',
  'we can', 'you can', 'they are', 'he was', 'she said', 'do it', 'look at', 'come here', 'out of', 'up and down',
  'can you see', 'look at me', 'come with me', 'help me', 'go to', 'get up', 'sit down', 'thank you', 'all day', 'every day',
  'right now', 'after school', 'in the morning', 'at night', 'under the bed', 'into the water', 'over the hill', 'a big dog', 'the red ball', 'my little sister',
  'a good day', 'so much', 'very fast', 'not now', 'what is this', 'where are you', 'who is there', 'how are you', 'please come in', 'see you soon',
];

export const SENTENCES = [
  'the dog ran to the big red ball',
  'we like to play in the snow',
  'my sister can jump so far',
  'look at the little yellow bird',
  'the cat is on the warm chair',
  'please help me find my blue coat',
  'they went to the farm after school',
  'she found a green apple under the tree',
  'we ate cake on my birthday',
  'the boy will ride in the boat',
  'my mother made bread today',
  'the sun is hot and the water is cold',
  'can you see the bird in the nest',
  'he put his shoe by the door',
  'we will walk to school in the morning',
  'the farmer has a cow and a pig',
  'my brother can run very fast',
  'the rabbit ate the green grass',
  'please read me a funny letter',
  'the children sing a song together',
  'the sun is up and the snow is white',
  'the baby is going to sleep now',
  'my father will clean the car',
  'she gave her doll a new name',
  'there is a big egg in the box',
  'we want to play a game',
  'the kitty is in the window',
  'the wind made the tree fall down',
  'look at the pretty flower in the garden',
  'we found a stick on the hill',
  'he can draw a picture of a horse',
  'the duck and the chicken live on the farm',
  'it is time to go home',
  'thank you for the cake and milk',
  'we like to ride the black and white horse',
  'come and sit with me at the table',
  'the girl will carry the small box',
  'six little fish live in the water',
  'we always wash before we eat',
  'they laugh and play all day',
];
