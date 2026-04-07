import { PaddlingConditions, PaddleDirectionAssessment, PaddleGuidance } from './types';
import { tideMovementLabel } from './tide-display';

const OUT_LABEL = 'toward Bucklands Beach (outgoing — roughly northeast)';
const IN_LABEL = 'back toward Ian Shaw Park (incoming — roughly southwest)';

function legWindNarrative(windDirection: string, leg: 'outgoing' | 'incoming'): string {
  if (leg === 'outgoing') {
    if (['SW', 'WSW', 'W'].includes(windDirection)) {
      return `a tailwind for the outward leg (${windDirection})`;
    }
    if (['NE', 'ENE', 'E'].includes(windDirection)) {
      return `a headwind for the outward leg (${windDirection})`;
    }
    return `crosswind effects for the outward leg (${windDirection})`;
  }
  if (['NE', 'ENE', 'E'].includes(windDirection)) {
    return `a tailwind for the return leg (${windDirection})`;
  }
  if (['SW', 'WSW', 'W'].includes(windDirection)) {
    return `a headwind for the return leg (${windDirection})`;
  }
  return `crosswind effects for the return leg (${windDirection})`;
}

function tideAssistSentence(
  tideDir: PaddlingConditions['tide']['direction'],
  tideHeight: number
): string {
  const h = tideHeight.toFixed(1);
  if (tideDir === 'outgoing') {
    return `The tide is falling (~${h} m) — it generally helps you move water toward Bucklands on the outgoing leg, and works against the return while it continues to ebb.`;
  }
  if (tideDir === 'incoming') {
    return `The tide is rising (~${h} m) — it generally helps you back toward Ian Shaw on the incoming leg, and works against the outgoing leg while it continues to flood.`;
  }
  return `The tide is near slack (~${h} m) — current is weak; wind matters more.`;
}

function buildHeadline(pd: PaddleDirectionAssessment, windSpeed: number): string {
  const { recommended, outgoing, incoming } = pd;
  const breezy = windSpeed >= 28 ? 'Breezy — ' : '';

  if (recommended === 'both') {
    if (outgoing.level === 'easy' && incoming.level === 'easy') {
      return `${breezy}Round trip looks good — both legs rate easy.`;
    }
    return `${breezy}Both directions are workable — compare scores for each leg below.`;
  }
  if (recommended === 'outgoing') {
    return `${breezy}Favour paddling out toward Bucklands Beach.`;
  }
  if (recommended === 'incoming') {
    return `${breezy}Favour the return toward Ian Shaw Park.`;
  }
  return `Hard for both legs — consider postponing or a much shorter paddle.`;
}

/**
 * Rich copy for extended forecast rows: what each paddle type means, why this hour
 * favours one leg or both, and what makes conditions easy or hard.
 */
export function buildPaddleGuidance(
  conditions: PaddlingConditions,
  pd: PaddleDirectionAssessment
): PaddleGuidance {
  const { weather, tide, location } = conditions;
  const { recommended, outgoing, incoming } = pd;
  const spread = weather.gustSpeed - weather.windSpeed;
  const tideWord = tideMovementLabel(tide);

  const paragraphs: string[] = [];

  paragraphs.push(
    `Outgoing means launching from ${location} and paddling ${OUT_LABEL}. Incoming means the return ${IN_LABEL}.`
  );

  const outN = legWindNarrative(weather.windDirection, 'outgoing');
  const inN = legWindNarrative(weather.windDirection, 'incoming');
  paragraphs.push(
    `Wind is ${weather.windSpeed} km/h from ${weather.windDirection} (gusts to ${weather.gustSpeed} km/h). That gives ${outN}, and ${inN}.`
  );

  if (spread >= 20) {
    paragraphs.push(
      `Gusts are much stronger than the mean wind (+${spread} km/h) — expect lumpy water, harder balance, and less room for error.`
    );
  } else if (spread >= 12) {
    paragraphs.push(
      `Gusts are noticeably above the mean wind (+${spread} km/h) — chop may build even if the breeze feels steady.`
    );
  }

  if (weather.windSpeed >= 35) {
    paragraphs.push(
      `Sustained wind is strong for many harbour paddles — treat this as a serious conditions day unless your crew is experienced.`
    );
  } else if (weather.windSpeed >= 28) {
    paragraphs.push(
      `Sustained wind is in a “firm” range for recreational paddling — fitness and steering matter more than on a light-air day.`
    );
  }

  paragraphs.push(tideAssistSentence(tide.direction, tide.height));

  paragraphs.push(
    `Tide column: ~${tide.height.toFixed(1)} m, ${tideWord} — use it together with wind, not on its own.`
  );

  let rec = '';
  if (recommended === 'both') {
    rec = `This hour’s scores: outgoing ${outgoing.score}/10 (${outgoing.level}), incoming ${incoming.score}/10 (${incoming.level}). Both legs can work — pick based on whether you’re heading out or back.`;
  } else if (recommended === 'outgoing') {
    rec = `Outgoing rates ${outgoing.score}/10 (${outgoing.level}) vs incoming ${incoming.score}/10 (${incoming.level}) — conditions favour paddling out more than returning right now.`;
  } else if (recommended === 'incoming') {
    rec = `Incoming rates ${incoming.score}/10 (${incoming.level}) vs outgoing ${outgoing.score}/10 (${outgoing.level}) — conditions favour the return leg more than heading out right now.`;
  } else {
    rec = `Outgoing ${outgoing.score}/10 (${outgoing.level}), incoming ${incoming.score}/10 (${incoming.level}) — both legs look difficult; wind, tide, or the combination is the main limiter.`;
  }
  paragraphs.push(rec);

  return {
    headline: buildHeadline(pd, weather.windSpeed),
    paragraphs
  };
}
