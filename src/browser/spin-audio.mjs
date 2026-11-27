// A short spring click and two-note result signal. Audio starts from a user gesture.
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
  tone(context, destination, 659.25, .12, .14);
  tone(context, destination, 987.77, .11, .20, .10);
}
