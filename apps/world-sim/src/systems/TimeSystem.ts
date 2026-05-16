const DAYS_PER_YEAR = 30;
const GAME_YEAR_MS = 60_000;
const GAME_DAY_MS = GAME_YEAR_MS / DAYS_PER_YEAR;

export class TimeSystem {
  private elapsedMs = 0;

  update(deltaMs: number) {
    if (deltaMs <= 0) {
      return;
    }

    this.elapsedMs += deltaMs;
  }

  getYear() {
    return Math.floor(this.elapsedMs / GAME_YEAR_MS) + 1;
  }

  getDayOfYear() {
    return Math.floor((this.elapsedMs % GAME_YEAR_MS) / GAME_DAY_MS) + 1;
  }

  getDayProgress() {
    return (this.elapsedMs % GAME_DAY_MS) / GAME_DAY_MS;
  }

  isNight() {
    return this.getDayProgress() >= 0.5;
  }

  getTimeLabel() {
    return `第${this.getYear()}年 第${this.getDayOfYear()}/30天 ${this.isNight() ? '夜晚' : '白天'}`;
  }
}
