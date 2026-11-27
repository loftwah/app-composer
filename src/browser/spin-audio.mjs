// A short spring click and short original result flourish. Audio starts from a user gesture.
function tone(context, destination, frequency, strength, seconds, delay = 0, type = 'triangle') {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(.001, start);
  envelope.gain.exponentialRampToValueAtTime(strength, start + .003);
  envelope.gain.exponentialRampToValueAtTime(.001, start + seconds);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + seconds + .01);
}

export function spinClick(context, destination = context.destination) {
  tone(context, destination, 620, .12, .042, 0, 'triangle');
  tone(context, destination, 1430, .025, .027, .001, 'square');
}

export function spinChime(context, destination = context.destination) {
  tone(context, destination, 587.33, .10, .13);
  tone(context, destination, 739.99, .10, .14, .072);
  tone(context, destination, 880, .11, .18, .144);
  tone(context, destination, 1174.66, .10, .30, .228);
  tone(context, destination, 293.66, .07, .27, .228);
}
