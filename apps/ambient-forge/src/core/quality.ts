export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityProfile {
  dprCap: number;
  cloudPuffs: number;
  weatherParticles: number;
  fireflies: number;
  stars: number;
  grassBlades: number;
  treeLeafClusters: number;
  distantIslands: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
}

const PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    dprCap: 1,
    cloudPuffs: 18,
    weatherParticles: 220,
    fireflies: 28,
    stars: 320,
    grassBlades: 96,
    treeLeafClusters: 3,
    distantIslands: 3,
    shadows: false,
    shadowMapSize: 0,
    antialias: false,
  },
  medium: {
    dprCap: 1.5,
    cloudPuffs: 30,
    weatherParticles: 480,
    fireflies: 54,
    stars: 620,
    grassBlades: 160,
    treeLeafClusters: 4,
    distantIslands: 4,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
  },
  high: {
    dprCap: 2,
    cloudPuffs: 44,
    weatherParticles: 840,
    fireflies: 88,
    stars: 960,
    grassBlades: 220,
    treeLeafClusters: 6,
    distantIslands: 5,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
  },
};

export const getQualityProfile = (quality: QualityLevel): QualityProfile => PROFILES[quality];
