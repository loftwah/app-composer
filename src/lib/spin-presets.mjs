/** @type {Array<[string, string, Array<[string, string, string, string[]]>]>} */
const groups = [
  ['food', 'Food & drink', [
    ['takeaway', 'Australian takeaway roulette', 'What takeaway should we get?', [
      'Maccas', 'Hungry Jack’s', 'KFC', 'Carl’s Jr.', 'Fish and chips', 'Pizza', 'Kebabs', 'HSP', 'Charcoal chicken',
      'Local burger shop', 'Chinese', 'Indian', 'Thai', 'Vietnamese', 'Japanese', 'Sushi', 'Subway', 'Nando’s',
      'Guzman y Gomez', 'Schnitz', 'Mexican', 'Chicken and chips', 'Bánh mì', 'Pub parma',
    ]],
    ['fast-food-three', 'Maccas, Hungry Jack’s & KFC', 'What’s for dinner?', ['Maccas', 'Hungry Jack’s', 'KFC']],
    ['dinner', 'Dinner', 'What’s for dinner?', ['Pizza', 'Thai', 'Tacos', 'Burgers', 'Pasta', 'Dumplings']],
    ['lunch', 'Lunch', 'What’s for lunch?', ['Bánh mì', 'Sushi rolls', 'Salad bowl', 'Toastie', 'Soup', 'Wrap']],
    ['breakfast', 'Breakfast', 'What’s for brekkie?', ['Eggs on toast', 'Porridge', 'Pancakes', 'Yoghurt and fruit', 'Breakfast roll']],
    ['coffee', 'Coffee', 'What coffee should I get?', ['Flat white', 'Long black', 'Cappuccino', 'Iced latte', 'Piccolo', 'Cold brew']],
    ['dessert', 'Dessert', 'What’s for dessert?', ['Gelato', 'Sticky date pudding', 'Brownie', 'Cheesecake', 'Apple crumble', 'Chocolate mousse']],
    ['cuisine', 'Cuisine', 'Which cuisine sounds good?', ['Italian', 'Japanese', 'Korean', 'Lebanese', 'Vietnamese', 'Indian', 'Chinese', 'Thai', 'Mexican', 'Greek']],
    ['home-or-order', 'Cook or order', 'Cook at home or order in?', ['Cook at home', 'Order in']],
    ['cook', 'Cook something', 'What should I cook?', ['Stir-fry', 'Pesto pasta', 'Chickpea curry', 'Tray bake', 'Fried rice', 'Tacos', 'Roast vegetables and couscous']],
    ['pantry-dinner', 'Pantry dinner', 'What can we cook from the pantry?', ['Egg fried rice', 'Pesto pasta', 'Bean tacos', 'Miso noodles', 'Chickpea curry', 'Loaded toastie']],
    ['vegetarian-takeaway', 'Vegetarian takeaway', 'What vegetarian takeaway should we get?', ['Falafel wrap', 'Veggie pizza', 'Veggie dumplings', 'Chana masala', 'Mushroom ramen', 'Tofu bánh mì']],
  ]],
  ['entertainment', 'Entertainment', [
    ['watch', 'What to watch', 'What should we watch?', ['A short film', 'A comedy special', 'An old favourite', 'A new series', 'A documentary', 'A live concert']],
    ['movies', 'Movie genres', 'What kind of film tonight?', ['Comedy', 'Science fiction', 'Thriller', 'Animation', 'Mystery', 'Drama', 'Action']],
    ['music', 'Music genres', 'What should we listen to?', ['Hip hop', 'Soul', 'House', 'Jazz', 'Indie rock', 'Drum and bass', 'Funk', 'Ambient']],
    ['game', 'Game night', 'What should we play?', ['Codenames', 'Mario Kart', 'Jackbox', 'Chess', 'Charades', 'Uno']],
    ['two-player', 'Game night for two', 'What should we play with two?', ['Chess', 'Patchwork', 'Carcassonne', 'Mario Kart', 'Overcooked 2', 'It Takes Two']],
    ['party-no-gear', 'Party games without gear', 'What should we play with no gear?', ['Charades', 'Twenty questions', 'Name that tune', 'Would you rather', 'Two truths and a lie', 'Categories']],
    ['listening-night', 'Listening night', 'How should we listen tonight?', ['Play a whole album', 'Trade three songs each', 'Find a local artist', 'Revisit an old favourite', 'Put on a live set', 'Make a two-sided mix']],
    ['play', 'What to play', 'What kind of game should I play?', ['Platformer', 'Puzzle', 'Strategy', 'Racing', 'Co-op adventure', 'Rhythm game']],
    ['weekend-show', 'Weekend entertainment', 'What should we go see?', ['Live music', 'Cinema', 'Comedy night', 'Local footy', 'A gallery', 'Community theatre']],
  ]],
  ['everyday', 'Everyday life', [
    ['today', 'Something to do', 'What should I do today?', ['Read a chapter', 'Take a photo walk', 'Call a friend', 'Make a playlist', 'Cook something new', 'Visit the library']],
    ['exercise', 'Get moving', 'How should I get moving?', ['Walk', 'Bike ride', 'Swim', 'Yoga', 'Strength session', 'Dance']],
    ['weekend', 'Weekend plans', 'What should we do this weekend?', ['Farmers market', 'Picnic', 'Day hike', 'Op shop', 'Garden', 'Board games']],
    ['hour-outdoors', 'An hour outdoors', 'Where should we spend an hour outside?', ['Creek walk', 'Bike path', 'Botanic gardens', 'Beach walk', 'Outdoor court', 'Dog park']],
    ['low-cost-day', 'Low-cost day out', 'What should we do without spending much?', ['Second-hand bookshop', 'Library event', 'Free gallery', 'Picnic', 'Community market', 'Street art walk']],
    ['chores', 'Household chores', 'Which chore gets done first?', ['Laundry', 'Vacuum', 'Wash dishes', 'Change sheets', 'Clean the bathroom', 'Take the bins out']],
    ['go', 'Somewhere to go', 'Where should we go?', ['A park', 'A bakery', 'A lookout', 'A library', 'A market', 'A pub']],
    ['date', 'Date night', 'What should we do for date night?', ['Cook together', 'Dessert out', 'Mini golf', 'Movie night', 'Sunset walk', 'Live music']],
    ['learn', 'Learn something', 'What should I learn next?', ['Basic guitar chords', 'Make fresh pasta', 'Photo composition', 'First-aid basics', 'A language lesson', 'Draw a still life']],
  ]],
  ['quick', 'Quick decisions', [
    ['yes', 'Yes or no', 'Should we do it?', ['Yes', 'No']],
    ['coin', 'Heads or tails', 'Call it!', ['Heads', 'Tails']],
    ['rock-paper-scissors', 'Rock, paper, scissors', 'What should I throw?', ['Rock', 'Paper', 'Scissors']],
    ['time-block', 'Pick a time block', 'How long should we give it?', ['5 minutes', '10 minutes', '15 minutes', '20 minutes', '30 minutes']],
    ['number', 'Pick a number', 'Pick a number from 1 to 10', Array.from({ length: 10 }, (_, i) => String(i + 1))],
    ['first', 'Who goes first?', 'Who goes first?', ['Player one', 'Player two', 'Player three', 'Player four']],
    ['person', 'Pick a person', 'Whose turn is it?', ['Me', 'You', 'The person on my left', 'The person on my right']],
    ['team', 'Pick a team', 'Which team goes first?', ['Red team', 'Blue team', 'Green team', 'Gold team']],
    ['custom', 'Custom wheel', '', []],
  ]],
];

export const spinPresetGroups = groups.map(([id, label, presets]) => ({
  id, label, presets: presets.map(([id, label, question, entries]) => ({ id, label, question, entries })),
}));

export const spinPresetById = Object.fromEntries(spinPresetGroups.flatMap(group => group.presets.map(preset => [preset.id, preset])));

export const spinDefaultPreset = 'fast-food-three';
