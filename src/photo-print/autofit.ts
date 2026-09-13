export type Keypoint = { x: number; y: number; score: number };

export type GarmentMeta = {
  anchor: { x: number; y: number };
  shoulderFraction: number;
};

/** COCO-17 landmark order used by MoveNet. */
export const KEYPOINT = {
  nose: 0,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
} as const;

/** How much wider than the body the garment shoulders should sit. */
export const SHOULDER_FACTOR = 1.3;
/**
 * The garment's shoulder line is placed on the person's shoulder line, so no
 * vertical raise is needed; the collar rises naturally above it.
 */
export const NECK_RAISE = 0;
export const MIN_KEYPOINT_SCORE = 0.2;

const SHOULDER_MIN_SCORE = 0.2;
const EAR_MIN_SCORE = 0.3;
const EYE_MIN_SCORE = 0.35;
/** Head width to anatomical shoulder width. */
const HEAD_TO_SHOULDER = 2.4;
/** Ear line to the base of the neck, in head-widths. */
const NECK_FROM_EAR = 0.55;
/** Eye separation to head width, used when ears are unavailable. */
const EYE_TO_HEAD = 1.8;

export type AutoFitInput = {
  keypoints: Keypoint[];
  width: number;
  height: number;
  garment: GarmentMeta;
  shoulderFactor?: number;
  neckRaise?: number;
  minScore?: number;
};

export type AutoFitResult = {
  anchorX: number;
  anchorY: number;
  scale: number;
  rotation: number;
  /** True when shoulders were missing and the fit came from the head size. */
  approximate?: boolean;
};

const MIN_SHOULDER_PX = 4;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function confident(
  point: Keypoint | undefined,
  min: number,
): point is Keypoint {
  return Boolean(point) && point!.score >= min;
}

/**
 * Derives a garment transform from pose landmarks. Pure so it can be unit
 * tested without a canvas or the ONNX runtime.
 *
 * Prefers the shoulder line. When the shoulders are cropped or low-confidence
 * (common in tight passport crops) it estimates the shoulder width from the
 * head size so Auto Fit still produces a usable starting point. Returns null
 * only when neither the shoulders nor the head landmarks can be trusted.
 */
export function computeAutoFit(input: AutoFitInput): AutoFitResult | null {
  const { keypoints, width, height, garment } = input;
  if (width <= 0 || height <= 0) return null;
  const minScore = input.minScore ?? MIN_KEYPOINT_SCORE;
  const nose = keypoints[KEYPOINT.nose];
  const leftShoulder = keypoints[KEYPOINT.leftShoulder];
  const rightShoulder = keypoints[KEYPOINT.rightShoulder];
  const leftEar = keypoints[KEYPOINT.leftEar];
  const rightEar = keypoints[KEYPOINT.rightEar];

  let neckX: number;
  let neckY: number;
  let shoulderWidth: number;
  let rotation: number;
  let approximate = false;

  const shouldersUsable =
    confident(leftShoulder, SHOULDER_MIN_SCORE) &&
    confident(rightShoulder, SHOULDER_MIN_SCORE) &&
    distance(leftShoulder, rightShoulder) >= MIN_SHOULDER_PX;

  if (shouldersUsable) {
    shoulderWidth = distance(leftShoulder, rightShoulder);
    // MoveNet's "left" landmark is the person's left, which appears on the
    // viewer's right. Using left - right keeps the axis pointing to the
    // viewer's right so a level person yields 0 degrees (not 180).
    rotation =
      (Math.atan2(
        leftShoulder.y - rightShoulder.y,
        leftShoulder.x - rightShoulder.x,
      ) *
        180) /
      Math.PI;
    neckX = (leftShoulder.x + rightShoulder.x) / 2;
    neckY = (leftShoulder.y + rightShoulder.y) / 2;
  } else {
    const earsUsable =
      confident(leftEar, EAR_MIN_SCORE) &&
      confident(rightEar, EAR_MIN_SCORE) &&
      distance(leftEar, rightEar) >= MIN_SHOULDER_PX;
    const leftEye = keypoints[1];
    const rightEye = keypoints[2];
    const eyesUsable =
      confident(leftEye, EYE_MIN_SCORE) &&
      confident(rightEye, EYE_MIN_SCORE) &&
      distance(leftEye, rightEye) >= MIN_SHOULDER_PX;

    let headLeft: Keypoint;
    let headRight: Keypoint;
    let headWidth: number;
    if (earsUsable) {
      headLeft = leftEar;
      headRight = rightEar;
      headWidth = distance(leftEar, rightEar);
    } else if (eyesUsable) {
      headLeft = leftEye;
      headRight = rightEye;
      headWidth = distance(leftEye, rightEye) * EYE_TO_HEAD;
    } else {
      return null;
    }

    approximate = true;
    // Same viewer-space convention as the shoulder line: left - right.
    const axisX = headLeft.x - headRight.x;
    const axisY = headLeft.y - headRight.y;
    const axisLength = Math.hypot(axisX, axisY) || 1;
    const unitX = axisX / axisLength;
    const unitY = axisY / axisLength;
    let downX = -unitY;
    let downY = unitX;
    const toNoseX = nose ? nose.x - (headLeft.x + headRight.x) / 2 : 0;
    const toNoseY = nose ? nose.y - (headLeft.y + headRight.y) / 2 : -1;
    if (downX * toNoseX + downY * toNoseY > 0) {
      downX = -downX;
      downY = -downY;
    }
    shoulderWidth = headWidth * HEAD_TO_SHOULDER;
    rotation = (Math.atan2(axisY, axisX) * 180) / Math.PI;
    neckX =
      (headLeft.x + headRight.x) / 2 + downX * headWidth * NECK_FROM_EAR;
    neckY =
      (headLeft.y + headRight.y) / 2 + downY * headWidth * NECK_FROM_EAR;
  }

  if (!Number.isFinite(shoulderWidth) || shoulderWidth < MIN_SHOULDER_PX) {
    return null;
  }

  let upX = 0;
  let upY = -1;
  if (confident(nose, minScore)) {
    const candidateX = nose.x - neckX;
    const candidateY = nose.y - neckY;
    const length = Math.hypot(candidateX, candidateY);
    if (length >= 1e-3) {
      upX = candidateX / length;
      upY = candidateY / length;
    }
  }

  const raise = input.neckRaise ?? NECK_RAISE;
  const anchorX = neckX + upX * shoulderWidth * raise;
  const anchorY = neckY + upY * shoulderWidth * raise;

  const shoulderFactor = input.shoulderFactor ?? SHOULDER_FACTOR;
  const fraction =
    garment.shoulderFraction > 0.05 ? garment.shoulderFraction : 0.85;
  const scale = (shoulderFactor * shoulderWidth) / (fraction * width);
  const clampedScale = Math.min(3, Math.max(0.15, scale));
  if (!Number.isFinite(clampedScale)) return null;

  return {
    anchorX: anchorX / width,
    anchorY: anchorY / height,
    scale: clampedScale,
    rotation,
    ...(approximate ? { approximate: true } : {}),
  };
}

/**
 * Maps landmarks from the unrotated crop into the rotated canvas space that
 * the shirt and mask are drawn in, mirroring `rotateCanvas` (which rotates
 * about the canvas centre after swapping width/height).
 */
export function rotateKeypoints(
  keypoints: Keypoint[],
  width: number,
  height: number,
  degrees: number,
): Keypoint[] {
  const normalized = ((degrees % 360) + 360) % 360;
  if (!normalized) return keypoints;
  const sideways = normalized === 90 || normalized === 270;
  const outWidth = sideways ? height : width;
  const outHeight = sideways ? width : height;
  const radians = (normalized * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = width / 2;
  const centerY = height / 2;
  return keypoints.map((keypoint) => {
    const dx = keypoint.x - centerX;
    const dy = keypoint.y - centerY;
    return {
      x: outWidth / 2 + dx * cos - dy * sin,
      y: outHeight / 2 + dx * sin + dy * cos,
      score: keypoint.score,
    };
  });
}
