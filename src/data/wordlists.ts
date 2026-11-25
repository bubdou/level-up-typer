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

// Test words: everyday English words picked for Level Up Typer. None of them is a practice item or
// appears in a practice phrase or sentence, so a test measures typing words the learner has not
// drilled. A unit test keeps it that way when practice lists grow.
export const TEST_WORDS = [
  'able', 'above', 'across', 'add', 'age', 'ago', 'agree', 'air', 'almost', 'alone', 'along',
  'already', 'also', 'among', 'angry', 'animal', 'another', 'answer', 'anyone', 'anything', 'area',
  'arm', 'army', 'art', 'aunt', 'awake', 'bag', 'band', 'bank', 'base', 'basket', 'bath', 'beach',
  'bean', 'beat', 'became', 'become', 'began', 'begin', 'behind', 'being', 'believe', 'below',
  'belt', 'bench', 'beside', 'between', 'beyond', 'bike', 'bill', 'bite', 'blank', 'block',
  'blood', 'board', 'body', 'bone', 'book', 'born', 'borrow', 'boss', 'bottle', 'bottom', 'bowl',
  'brain', 'branch', 'brave', 'break', 'breakfast', 'bridge', 'bright', 'broke', 'brush', 'build',
  'built', 'burn', 'bus', 'busy', 'butter', 'button', 'cabin', 'camp', 'candy', 'cap', 'card',
  'care', 'careful', 'case', 'catch', 'cause', 'center', 'chain', 'chance', 'change', 'chase',
  'cheap', 'check', 'cheese', 'chest', 'chin', 'choose', 'circle', 'city', 'class', 'clear',
  'climb', 'clock', 'close', 'cloud', 'club', 'coach', 'coast', 'coin', 'collect', 'color',
  'corner', 'cost', 'cotton', 'couch', 'count', 'country', 'course', 'cousin', 'cover', 'crab',
  'crash', 'crazy', 'cream', 'cross', 'crowd', 'cry', 'cup', 'curve', 'daily', 'dance', 'danger',
  'dark', 'dear', 'decide', 'deep', 'desk', 'dinner', 'dirt', 'dish', 'doctor', 'dollar', 'dot',
  'double', 'dream', 'dress', 'drive', 'drop', 'dry', 'dust', 'each', 'early', 'earn', 'earth',
  'east', 'easy', 'edge', 'empty', 'end', 'enjoy', 'enough', 'enter', 'equal', 'even', 'evening',
  'ever', 'everyone', 'exact', 'example', 'except', 'exit', 'extra', 'face', 'fact', 'fair',
  'family', 'fan', 'fear', 'feel', 'fell', 'felt', 'fence', 'few', 'field', 'fight', 'fill',
  'final', 'fine', 'finger', 'finish', 'fix', 'flag', 'flat', 'float', 'follow', 'food', 'foot',
  'force', 'forest', 'forget', 'fork', 'form', 'forward', 'fox', 'free', 'fresh', 'friend',
  'front', 'fruit', 'fun', 'gate', 'gift', 'glad', 'glass', 'glove', 'goal', 'gold', 'grade',
  'grand', 'gray', 'great', 'group', 'guess', 'guide', 'half', 'hall', 'happen', 'happy', 'hard',
  'heart', 'heat', 'heavy', 'hello', 'hide', 'high', 'hike', 'history', 'hit', 'hole', 'holiday',
  'honey', 'hope', 'hour', 'huge', 'human', 'hungry', 'hurry', 'ice', 'idea', 'inside', 'island',
  'jacket', 'jam', 'jar', 'jeans', 'jelly', 'job', 'join', 'joke', 'juice', 'jungle', 'key',
  'kick', 'kid', 'kitchen', 'knee', 'knife', 'knock', 'lake', 'lamp', 'land', 'large', 'last',
  'late', 'later', 'lazy', 'lead', 'learn', 'least', 'leave', 'left', 'lemon', 'lesson', 'level',
  'lift', 'line', 'lion', 'list', 'listen', 'load', 'lock', 'lose', 'loud', 'love', 'low', 'lucky',
  'lunch', 'machine', 'mad', 'main', 'major', 'map', 'mark', 'market', 'match', 'maybe', 'meal',
  'mean', 'meat', 'meet', 'melt', 'metal', 'middle', 'mile', 'mind', 'minute', 'mirror', 'miss',
  'mix', 'model', 'moment', 'monkey', 'month', 'moon', 'more', 'most', 'mountain', 'mouse',
  'mouth', 'move', 'movie', 'music', 'near', 'neck', 'need', 'next', 'nice', 'noise', 'north',
  'nose', 'note', 'nothing', 'number', 'object', 'ocean', 'offer', 'often', 'oil', 'okay', 'order',
  'other', 'outside', 'page', 'paint', 'pair', 'pan', 'park', 'part', 'pass', 'past', 'path',
  'pay', 'peace', 'pen', 'pencil', 'people', 'pet', 'phone', 'piano', 'piece', 'pink', 'place',
  'plan', 'plane', 'plant', 'plate', 'point', 'pond', 'pool', 'poor', 'pop', 'power', 'present',
  'price', 'prize', 'problem', 'push', 'puzzle', 'quarter', 'queen', 'question', 'quick', 'quiet',
  'quite', 'quiz', 'race', 'radio', 'relax', 'rest', 'rice', 'rich', 'river', 'road', 'rock',
  'roof', 'room', 'rope', 'rule', 'safe', 'sail', 'salt', 'same', 'sand', 'save', 'scared',
  'score', 'sea', 'seat', 'second', 'secret', 'sell', 'send', 'sense', 'set', 'shape', 'share',
  'sharp', 'shirt', 'shop', 'short', 'shout', 'side', 'sign', 'silly', 'silver', 'simple', 'since',
  'size', 'skate', 'skip', 'sky', 'slide', 'slow', 'smell', 'smile', 'smoke', 'snack', 'sock',
  'soft', 'soil', 'sort', 'sound', 'soup', 'south', 'space', 'speak', 'special', 'speed', 'spell',
  'spend', 'spoon', 'sport', 'spot', 'spring', 'square', 'stair', 'stamp', 'stand', 'star', 'stay',
  'step', 'still', 'stone', 'store', 'storm', 'story', 'strong', 'study', 'such', 'sugar',
  'summer', 'sweet', 'swim', 'switch', 'tail', 'talk', 'tall', 'taste', 'taxi', 'team', 'teeth',
  'tent', 'test', 'than', 'thick', 'thin', 'third', 'though', 'throw', 'ticket', 'tiny', 'tired',
  'title', 'toast', 'toe', 'tomato', 'tooth', 'touch', 'tower', 'town', 'track', 'train', 'travel',
  'trip', 'truck', 'true', 'turn', 'twelve', 'twin', 'uncle', 'until', 'usual', 'valley', 'van',
  'view', 'visit', 'voice', 'wait', 'wake', 'wall', 'wave', 'wax', 'weak', 'wear', 'week',
  'weight', 'west', 'wet', 'whale', 'wheel', 'while', 'whole', 'wide', 'wild', 'win', 'wing',
  'winter', 'wire', 'wise', 'woman', 'wonder', 'word', 'world', 'worry', 'yard', 'year', 'young',
  'zebra', 'zero', 'zip', 'zone', 'zoo',
];
