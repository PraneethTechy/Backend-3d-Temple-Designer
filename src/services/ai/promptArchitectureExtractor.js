/**
 * DevaSetu Prompt Architecture Extractor
 * Deterministically parses natural language user prompts for architectural specifications:
 * - Gopuram counts and directional placement (North, South, East, West, Central, VIP)
 * - Entrance and Exit gate counts
 * - VIP / Fast Darshan entrances
 * - Sanctum positioning (central vs eastern axis) and scale
 * - Circumambulatory / Pradakshina pathways
 * - Queue area counts, systems, and geometric shapes
 */

export function extractArchitecturalIntentFromPrompt(prompt = '', site = { length: 60, width: 35 }) {
  const p = (prompt || '').toLowerCase();

  // 1. Gopuram Count & Directions
  let gopuramCount = 2; // Default baseline: Entrance Gopuram + Main Raja Gopuram
  const gopuramMatch =
    p.match(/(\d+)\s*(?:cardinal\s*)?gopurams?/i) ||
    p.match(/(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:cardinal\s*)?gopurams?/i);

  if (gopuramMatch) {
    const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    gopuramCount = wordMap[gopuramMatch[1].toLowerCase()] || parseInt(gopuramMatch[1], 10);
  } else if (/north,\s*south,\s*east\s*(?:and|&)?\s*west/i.test(p)) {
    gopuramCount = 4;
  }

  const gopuramDirections = [];
  if (/north/i.test(p)) gopuramDirections.push('north');
  if (/south/i.test(p)) gopuramDirections.push('south');
  if (/east/i.test(p)) gopuramDirections.push('east');
  if (/west/i.test(p)) gopuramDirections.push('west');
  if (/main|central|raja/i.test(p)) gopuramDirections.push('main');
  if (/vip/i.test(p)) gopuramDirections.push('vip');

  if (gopuramCount === 4 && gopuramDirections.length < 4) {
    gopuramDirections.splice(0, gopuramDirections.length, 'north', 'south', 'east', 'west');
  } else if (gopuramCount === 6 && gopuramDirections.length < 6) {
    gopuramDirections.splice(0, gopuramDirections.length, 'north', 'south', 'east', 'west', 'main', 'vip');
  } else if (gopuramCount === 2 && gopuramDirections.length === 0) {
    gopuramDirections.splice(0, gopuramDirections.length, 'entrance', 'main');
  }

  // 2. Entrance Count & VIP
  let entranceCount = 1;
  const entranceMatch =
    p.match(/(\d+)\s*(?:entrance|entry)(?:\s*gates?|\s*structures?|\s*points?)?/i) ||
    p.match(/(one|two|three|four|five|six)\s*(?:entrance|entry)(?:\s*gates?|\s*structures?|\s*points?)?/i);

  if (entranceMatch) {
    const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    entranceCount = wordMap[entranceMatch[1].toLowerCase()] || parseInt(entranceMatch[1], 10);
  }

  const hasVipEntrance = /vip\s*entrance|vip\s*gate|vip\s*entry|special\s*entrance|vip\s*darshan/i.test(p);
  if (hasVipEntrance && entranceCount < 2) {
    // If VIP requested without specifying multiple entrances, ensure at least 2 entrance channels
    entranceCount = 2;
  }

  // 3. Exit Count
  let exitCount = 1;
  const exitMatch =
    p.match(/(\d+)\s*exits?(?:\s*gates?|\s*structures?|\s*corridors?|\s*portals?)?/i) ||
    p.match(/(one|two|three|four)\s*exits?(?:\s*gates?|\s*structures?|\s*corridors?|\s*portals?)?/i);

  if (exitMatch) {
    const wordMap = { one: 1, two: 2, three: 3, four: 4 };
    exitCount = wordMap[exitMatch[1].toLowerCase()] || parseInt(exitMatch[1], 10);
  }

  // 4. Sanctum Position & Scale
  const hasCentralSanctum = /central\s*sanctum|sanctum\s*(?:in\s*the\s*)?center|center\s*sanctum|central\s*garbhagriha/i.test(p);
  const sanctumPosition = hasCentralSanctum ? 'center' : 'east';
  const isLargeSanctum = /large\s*(?:central\s*)?sanctum|maha\s*garbhagriha|grand\s*sanctum/i.test(p);
  const sanctumSize = isLargeSanctum ? 'large' : 'standard';

  // 5. Circumambulatory Path (Pradakshina / Parikrama)
  const hasCircumambulatoryPath = /circumambulatory|pradakshina|parikrama/i.test(p);

  // 6. Queue System Areas & Count
  let queueSystemCount = 1;
  const queueMatch =
    p.match(/(\d+)\s*(?:entrance\s*)?queues?(?:\s*areas?|\s*systems?|\s*zones?)?/i) ||
    p.match(/(one|two|three|four|five)\s*(?:entrance\s*)?queues?(?:\s*areas?|\s*systems?|\s*zones?)?/i) ||
    p.match(/(\d+)\s*queue\s*(?:areas?|zones?|systems?)/i) ||
    p.match(/(one|two|three|four|five)\s*queue\s*(?:areas?|zones?|systems?)/i);

  if (queueMatch) {
    const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    queueSystemCount = wordMap[queueMatch[1].toLowerCase()] || parseInt(queueMatch[1], 10);
  }

  // 7. Preferred Queue Shape / Template
  let preferredTemplate = 'parallel';
  if (/serpentine|zig-zag|zigzag/i.test(p)) {
    preferredTemplate = 'serpentine';
  } else if (/u-shape|u_shape|ushape|u-shaped/i.test(p)) {
    preferredTemplate = 'u_shape';
  } else if (/s-shape|s_shape|sshape|s-shaped/i.test(p)) {
    preferredTemplate = 's_shape';
  } else if (/arc|curved|curve/i.test(p)) {
    preferredTemplate = 'arc';
  } else if (/radial|fan/i.test(p)) {
    preferredTemplate = 'radial';
  } else if (/split|converging/i.test(p)) {
    preferredTemplate = 'split';
  }

  return {
    gopuramCount,
    gopuramDirections,
    entranceCount,
    exitCount,
    hasVipEntrance,
    hasCircumambulatoryPath,
    sanctumPosition,
    sanctumSize,
    queueSystemCount,
    preferredTemplate,
  };
}
