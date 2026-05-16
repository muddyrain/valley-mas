import * as Phaser from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../config/buildings';
import type { ResourceSystem } from './ResourceSystem';

export type BuildingStatus = 'queued' | 'building' | 'complete';

export type BuildingInstance = {
  id: string;
  type: BuildingType;
  factionId: string;
  position: Phaser.Math.Vector2;
  hp: number;
  progress: number;
  progressRequired: number;
  status: BuildingStatus;
};

const BUILD_PROGRESS_PER_SECOND = 35;
const HUT_CAPACITY = 5;
const BUILDING_SPACING = 16;

export class BuildSystem {
  private readonly buildings: BuildingInstance[] = [];
  private dirty = true;
  private nextBuildingId = 1;
  private populationDemand = 1;

  constructor(
    private readonly resourceSystem: ResourceSystem,
    private readonly buildPoint: Phaser.Math.Vector2,
    private readonly factionId = 'faction-1',
  ) {}

  getBuildings() {
    return this.buildings.map((building) => ({
      ...building,
      position: building.position.clone(),
    }));
  }

  getBuilding(buildingId: string) {
    const building = this.buildings.find((candidate) => candidate.id === buildingId);

    if (!building) {
      return undefined;
    }

    return {
      ...building,
      position: building.position.clone(),
    };
  }

  getSummary() {
    const activeBuilding = this.getActiveBuilding();

    if (!activeBuilding) {
      return '建造：等待木材';
    }

    const def = BUILDING_DEFS[activeBuilding.type];

    if (activeBuilding.status === 'complete') {
      return `建造：${def.name} 已完成`;
    }

    const progress = Math.floor((activeBuilding.progress / activeBuilding.progressRequired) * 100);
    return `建造：${def.name} ${progress}%`;
  }

  consumeDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  hasBuildTask() {
    return Boolean(this.getActiveBuildTask() || this.tryQueueInitialBuilding());
  }

  setPopulationDemand(population: number) {
    const nextDemand = Math.max(1, Math.ceil(Math.max(0, Math.floor(population)) / HUT_CAPACITY));

    if (nextDemand === this.populationDemand) {
      return;
    }

    this.populationDemand = nextDemand;
    this.dirty = true;
  }

  getBuildTarget() {
    const task = this.getActiveBuildTask() ?? this.tryQueueInitialBuilding();
    return task?.position.clone();
  }

  buildAt(position: Phaser.Math.Vector2, deltaMs: number) {
    const task = this.getActiveBuildTask() ?? this.tryQueueInitialBuilding();

    if (!task) {
      return false;
    }

    if (
      Phaser.Math.Distance.Between(position.x, position.y, task.position.x, task.position.y) > 8
    ) {
      return false;
    }

    if (task.status === 'queued') {
      const def = BUILDING_DEFS[task.type];

      if (!this.resourceSystem.spend(def.cost)) {
        return false;
      }

      task.status = 'building';
      this.dirty = true;
    }

    task.progress = Math.min(
      task.progressRequired,
      task.progress + (BUILD_PROGRESS_PER_SECOND * deltaMs) / 1000,
    );

    if (task.progress >= task.progressRequired) {
      task.status = 'complete';
    }

    this.dirty = true;
    return task.status === 'complete';
  }

  damageBuilding(buildingId: string, damage: number) {
    const building = this.buildings.find((candidate) => candidate.id === buildingId);

    if (!building) {
      return false;
    }

    building.hp = Math.max(0, building.hp - Math.max(0, Math.floor(damage)));
    this.dirty = true;

    if (building.hp > 0) {
      return false;
    }

    this.buildings.splice(
      this.buildings.findIndex((candidate) => candidate.id === buildingId),
      1,
    );
    this.dirty = true;
    return true;
  }

  private getActiveBuilding() {
    return this.buildings.at(-1);
  }

  private getActiveBuildTask() {
    return this.buildings.find((building) => building.status !== 'complete');
  }

  private tryQueueInitialBuilding() {
    if (this.countCompletedOrQueuedHuts() >= this.populationDemand) {
      return undefined;
    }

    const def = BUILDING_DEFS.hut;

    if (!this.resourceSystem.canAfford(def.cost)) {
      return undefined;
    }

    const building: BuildingInstance = {
      id: `building-${this.nextBuildingId}`,
      type: def.id,
      factionId: this.factionId,
      position: this.getNextHutPosition(),
      hp: def.hp,
      progress: 0,
      progressRequired: def.buildProgressRequired,
      status: 'queued',
    };

    this.nextBuildingId += 1;
    this.buildings.push(building);
    this.dirty = true;
    return building;
  }

  private countCompletedOrQueuedHuts() {
    return this.buildings.filter((building) => building.type === 'hut').length;
  }

  private getNextHutPosition() {
    const hutIndex = this.countCompletedOrQueuedHuts();
    const column = hutIndex % 2;
    const row = Math.floor(hutIndex / 2);

    return new Phaser.Math.Vector2(
      this.buildPoint.x + column * BUILDING_SPACING,
      this.buildPoint.y + row * BUILDING_SPACING,
    );
  }
}
