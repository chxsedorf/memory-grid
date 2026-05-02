"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Phase = "title" | "memorize" | "hidden" | "clear" | "failed";
type CellObject = "empty" | "player" | "goal" | "wall" | "movingWall";
type Direction = "up" | "down" | "left" | "right";
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Stage = {
  id: number;
  name: string;
  subtitle: string;
  size: number;
  memorizeSeconds: number;
  playerStart: number;
  goal: number;
  movingWall: number;
  movingWallMoveTo: number;
  movingWallMoveChance: number;
  walls: number[];
};

const STAGE_COUNT = 50;

const cornerPairs: { start: Corner; goal: Corner }[] = [
  { start: "top-left", goal: "bottom-right" },
  { start: "top-right", goal: "bottom-left" },
  { start: "bottom-left", goal: "top-right" },
  { start: "bottom-right", goal: "top-left" },
];

const objectLabels: Record<CellObject, string> = {
  empty: "",
  player: "START",
  goal: "GOAL",
  wall: "",
  movingWall: "",
};

const objectSymbol: Record<CellObject, string> = {
  empty: "",
  player: "●",
  goal: "◎",
  wall: "",
  movingWall: "",
};

const createRandom = (seed: number) => {
  let value = seed % 2147483647;

  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const getCornerIndex = (corner: Corner, size: number) => {
  if (corner === "top-left") return 0;
  if (corner === "top-right") return size - 1;
  if (corner === "bottom-left") return size * (size - 1);
  return size * size - 1;
};

const getNeighbors = (position: number, size: number) => {
  const row = Math.floor(position / size);
  const col = position % size;
  const neighbors: number[] = [];

  if (row > 0) neighbors.push((row - 1) * size + col);
  if (row < size - 1) neighbors.push((row + 1) * size + col);
  if (col > 0) neighbors.push(row * size + (col - 1));
  if (col < size - 1) neighbors.push(row * size + (col + 1));

  return neighbors;
};

const shuffleArray = <T,>(items: T[], random: () => number) => {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
};

const getDirection = (from: number, to: number, size: number): Direction => {
  const fromRow = Math.floor(from / size);
  const fromCol = from % size;
  const toRow = Math.floor(to / size);
  const toCol = to % size;

  if (toRow < fromRow) return "up";
  if (toRow > fromRow) return "down";
  if (toCol < fromCol) return "left";
  return "right";
};

const getStageObstacleSet = (stage: Stage) => {
  return new Set([...stage.walls, stage.movingWall, stage.movingWallMoveTo]);
};

const hasPath = (
  stage: Pick<Stage, "size">,
  from: number,
  to: number,
  obstacleSet: Set<number>
) => {
  const queue = [from];
  const visited = new Set<number>([from]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) break;
    if (current === to) return true;

    for (const nextPosition of getNeighbors(current, stage.size)) {
      if (visited.has(nextPosition)) continue;
      if (obstacleSet.has(nextPosition)) continue;

      visited.add(nextPosition);
      queue.push(nextPosition);
    }
  }

  return false;
};

const checkStageRoute = (stage: Stage) => {
  const obstacleSet = getStageObstacleSet(stage);

  obstacleSet.delete(stage.playerStart);
  obstacleSet.delete(stage.goal);

  return hasPath(stage, stage.playerStart, stage.goal, obstacleSet);
};

const createSimplePath = (
  size: number,
  playerStart: number,
  goal: number,
  random: () => number
) => {
  const path = new Set<number>();

  let current = playerStart;
  let row = Math.floor(current / size);
  let col = current % size;

  const goalRow = Math.floor(goal / size);
  const goalCol = goal % size;

  let lastDirection: Direction | null = null;
  let straightCount = 0;
  let guard = 0;

  path.add(current);

  while (current !== goal && guard < size * size * 12) {
    guard++;

    const candidates: { position: number; direction: Direction }[] = [];

    const addCandidate = (
      nextRow: number,
      nextCol: number,
      direction: Direction
    ) => {
      if (
        nextRow < 0 ||
        nextRow >= size ||
        nextCol < 0 ||
        nextCol >= size
      ) {
        return;
      }

      if (lastDirection === direction && straightCount >= 3) {
        return;
      }

      const position = nextRow * size + nextCol;
      candidates.push({ position, direction });
    };

    const shouldMoveVertical =
      row !== goalRow && (col === goalCol || random() < 0.5);

    if (shouldMoveVertical) {
      addCandidate(
        row + (row < goalRow ? 1 : -1),
        col,
        row < goalRow ? "down" : "up"
      );

      if (col !== goalCol) {
        addCandidate(
          row,
          col + (col < goalCol ? 1 : -1),
          col < goalCol ? "right" : "left"
        );
      }
    } else {
      if (col !== goalCol) {
        addCandidate(
          row,
          col + (col < goalCol ? 1 : -1),
          col < goalCol ? "right" : "left"
        );
      }

      if (row !== goalRow) {
        addCandidate(
          row + (row < goalRow ? 1 : -1),
          col,
          row < goalRow ? "down" : "up"
        );
      }
    }

    if (candidates.length === 0) {
      if (row !== goalRow) {
        const direction = row < goalRow ? "down" : "up";

        row += row < goalRow ? 1 : -1;
        current = row * size + col;

        straightCount = lastDirection === direction ? straightCount + 1 : 1;
        lastDirection = direction;
        path.add(current);
        continue;
      }

      if (col !== goalCol) {
        const direction = col < goalCol ? "right" : "left";

        col += col < goalCol ? 1 : -1;
        current = row * size + col;

        straightCount = lastDirection === direction ? straightCount + 1 : 1;
        lastDirection = direction;
        path.add(current);
        continue;
      }
    }

    const next = candidates[Math.floor(random() * candidates.length)];

    current = next.position;
    row = Math.floor(current / size);
    col = current % size;

    straightCount = lastDirection === next.direction ? straightCount + 1 : 1;
    lastDirection = next.direction;

    path.add(current);
  }

  path.add(goal);

  return path;
};

const createWindingPath = (
  size: number,
  playerStart: number,
  goal: number,
  random: () => number
) => {
  const path = new Set<number>();
  const visited = new Set<number>();

  let current = playerStart;
  let lastDirection: Direction | null = null;
  let straightCount = 0;
  let guard = 0;

  path.add(current);
  visited.add(current);

  while (current !== goal && guard < size * size * 14) {
    guard++;

    const currentRow = Math.floor(current / size);
    const currentCol = current % size;
    const goalRow = Math.floor(goal / size);
    const goalCol = goal % size;

    const currentDistance =
      Math.abs(currentRow - goalRow) + Math.abs(currentCol - goalCol);

    const neighbors = shuffleArray(getNeighbors(current, size), random);

    const candidates = neighbors.filter((next) => {
      if (visited.has(next) && next !== goal) return false;

      const direction = getDirection(current, next, size);

      if (lastDirection === direction && straightCount >= 3) {
        return false;
      }

      const nextRow = Math.floor(next / size);
      const nextCol = next % size;
      const nextDistance =
        Math.abs(nextRow - goalRow) + Math.abs(nextCol - goalCol);

      return nextDistance <= currentDistance + 2;
    });

    const closerCandidates = candidates.filter((next) => {
      const nextRow = Math.floor(next / size);
      const nextCol = next % size;
      const nextDistance =
        Math.abs(nextRow - goalRow) + Math.abs(nextCol - goalCol);

      return nextDistance < currentDistance;
    });

    const turningCandidates = candidates.filter((next) => {
      const direction = getDirection(current, next, size);
      return direction !== lastDirection;
    });

    let pool = candidates;

    if (straightCount >= 2 && turningCandidates.length > 0) {
      pool = turningCandidates;
    } else if (closerCandidates.length > 0 && random() < 0.62) {
      pool = closerCandidates;
    }

    if (pool.length === 0) {
      return createSimplePath(size, playerStart, goal, random);
    }

    const next = pool[Math.floor(random() * pool.length)];
    const nextDirection = getDirection(current, next, size);

    straightCount = lastDirection === nextDirection ? straightCount + 1 : 1;
    lastDirection = nextDirection;
    current = next;

    path.add(current);
    visited.add(current);
  }

  if (!path.has(goal)) {
    return createSimplePath(size, playerStart, goal, random);
  }

  return path;
};

const expandSafePath = (
  safePath: Set<number>,
  size: number,
  random: () => number,
  stageNumber: number
) => {
  const expanded = new Set<number>(safePath);

  const expansionRate =
    stageNumber <= 10
      ? 0.2
      : stageNumber <= 20
        ? 0.14
        : stageNumber <= 30
          ? 0.09
          : 0.05;

  for (const position of safePath) {
    for (const neighbor of getNeighbors(position, size)) {
      if (random() < expansionRate) {
        expanded.add(neighbor);
      }
    }
  }

  return expanded;
};

const getStageSize = (stageNumber: number) => {
  if (stageNumber <= 3) return 4;
  if (stageNumber <= 6) return 5;
  if (stageNumber <= 10) return 6;
  if (stageNumber <= 14) return 7;
  if (stageNumber <= 18) return 8;
  if (stageNumber <= 22) return 9;
  if (stageNumber <= 26) return 10;
  if (stageNumber <= 30) return 11;
  if (stageNumber <= 34) return 12;
  if (stageNumber <= 38) return 13;
  if (stageNumber <= 42) return 14;
  if (stageNumber <= 46) return 15;
  return 16;
};

const getStageSubtitle = (stageNumber: number) => {
  if (stageNumber <= 5) return "BASIC GRID";
  if (stageNumber <= 10) return "SCATTER GRID";
  if (stageNumber <= 15) return "MEMORY ROUTE";
  if (stageNumber <= 20) return "BLACK PATH";
  if (stageNumber <= 25) return "HARD GRID";
  if (stageNumber <= 30) return "DEEP GRID";
  if (stageNumber <= 35) return "EXTREME GRID";
  if (stageNumber <= 42) return "MASTER GRID";
  if (stageNumber <= 46) return "NIGHTMARE GRID";
  return "FINAL MEMORY";
};

const createStageWalls = (
  stageNumber: number,
  size: number,
  playerStart: number,
  goal: number,
  safePath: Set<number>,
  random: () => number
) => {
  const totalCells = size * size;

  const wallDensity = Math.min(0.62, 0.24 + stageNumber * 0.0085);
  const targetWallCount = Math.floor(totalCells * wallDensity);

  const candidates: number[] = [];

  for (let i = 0; i < totalCells; i++) {
    if (i === playerStart) continue;
    if (i === goal) continue;
    if (safePath.has(i)) continue;

    candidates.push(i);
  }

  const shuffledCandidates = shuffleArray(candidates, random);
  const walls: number[] = [];

  for (const position of shuffledCandidates) {
    const row = Math.floor(position / size);
    const col = position % size;

    const edgePenalty =
      row === 0 || row === size - 1 || col === 0 || col === size - 1
        ? 0.78
        : 1;

    const checkerPattern =
      (row * 3 + col * 5 + stageNumber) % 7 === 0 ||
      (row * 5 + col * 2 + stageNumber * 3) % 11 === 0;

    const clusterPattern =
      stageNumber >= 12 &&
      ((row + col + stageNumber) % 5 === 0 ||
        (row * col + stageNumber) % 13 === 0);

    const keepCandidate =
      checkerPattern || clusterPattern || random() < 0.72 * edgePenalty;

    if (!keepCandidate) continue;

    const testWalls = new Set([...walls, position]);

    if (hasPath({ size }, playerStart, goal, testWalls)) {
      walls.push(position);
    }

    if (walls.length >= targetWallCount) break;
  }

  const fakePathAttempts = Math.floor(size * 1.8);

  for (let attempt = 0; attempt < fakePathAttempts; attempt++) {
    const openCandidates: number[] = [];

    for (let i = 0; i < totalCells; i++) {
      if (i === playerStart) continue;
      if (i === goal) continue;
      if (safePath.has(i)) continue;
      if (walls.includes(i)) continue;

      const neighbors = getNeighbors(i, size);
      const wallNeighborCount = neighbors.filter((n) =>
        walls.includes(n)
      ).length;

      if (wallNeighborCount >= 2) {
        openCandidates.push(i);
      }
    }

    if (openCandidates.length === 0) break;

    const fakeOpen =
      openCandidates[Math.floor(random() * openCandidates.length)];

    const nearby = getNeighbors(fakeOpen, size).filter((n) => {
      if (n === playerStart || n === goal) return false;
      if (safePath.has(n)) return false;
      if (walls.includes(n)) return false;
      return true;
    });

    const shuffledNearby = shuffleArray(nearby, random);

    for (const candidate of shuffledNearby.slice(0, 2)) {
      const testWalls = new Set([...walls, candidate]);

      if (hasPath({ size }, playerStart, goal, testWalls)) {
        walls.push(candidate);
      }

      if (walls.length >= targetWallCount) break;
    }

    if (walls.length >= targetWallCount) break;
  }

  return walls;
};

const createMovingWall = (
  size: number,
  playerStart: number,
  goal: number,
  walls: number[],
  safePath: Set<number>,
  random: () => number
) => {
  const totalCells = size * size;
  const wallSet = new Set(walls);
  const candidates: number[] = [];

  for (let i = 0; i < totalCells; i++) {
    if (i === playerStart) continue;
    if (i === goal) continue;
    if (safePath.has(i)) continue;
    if (wallSet.has(i)) continue;

    candidates.push(i);
  }

  const scoredCandidates = candidates
    .map((position) => {
      const neighbors = getNeighbors(position, size);
      const wallNeighborCount = neighbors.filter((n) => wallSet.has(n)).length;

      return {
        position,
        score: wallNeighborCount + random(),
      };
    })
    .sort((a, b) => b.score - a.score);

  const movingWall = scoredCandidates[0]?.position ?? -1;
  const movingWallMoveTo = scoredCandidates[1]?.position ?? movingWall;

  return {
    movingWall,
    movingWallMoveTo,
  };
};

const generateStages = (count: number, seed: number): Stage[] => {
  const random = createRandom(seed);

  return Array.from({ length: count }).map((_, index) => {
    const stageNumber = index + 1;
    const size = getStageSize(stageNumber);

    const cornerPair = cornerPairs[Math.floor(random() * cornerPairs.length)];
    const playerStart = getCornerIndex(cornerPair.start, size);
    const goal = getCornerIndex(cornerPair.goal, size);

    const rawPath = createWindingPath(size, playerStart, goal, random);
    const safePath = expandSafePath(rawPath, size, random, stageNumber);

    const walls = createStageWalls(
      stageNumber,
      size,
      playerStart,
      goal,
      safePath,
      random
    );

    const { movingWall, movingWallMoveTo } = createMovingWall(
      size,
      playerStart,
      goal,
      walls,
      safePath,
      random
    );

    const memorizeSeconds = Math.max(0.65, 3.0 - stageNumber * 0.05);

    return {
      id: stageNumber,
      name: `LEVEL ${String(stageNumber).padStart(2, "0")}`,
      subtitle: getStageSubtitle(stageNumber),
      size,
      memorizeSeconds: Number(memorizeSeconds.toFixed(1)),
      playerStart,
      goal,
      movingWall,
      movingWallMoveTo,
      movingWallMoveChance: Math.min(0.9, 0.18 + stageNumber * 0.014),
      walls,
    };
  });
};

export default function Home() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [stages, setStages] = useState<Stage[]>(() =>
    generateStages(STAGE_COUNT, 12345)
  );
  const [phase, setPhase] = useState<Phase>("title");
  const [stageIndex, setStageIndex] = useState(0);
  const [clearedStages, setClearedStages] = useState<number[]>([]);
  const [playerPosition, setPlayerPosition] = useState(stages[0].playerStart);
  const [playerMoved, setPlayerMoved] = useState(false);
  const [message, setMessage] = useState("READY");
  const [countdown, setCountdown] = useState(stages[0].memorizeSeconds);
  const [movingWallPosition, setMovingWallPosition] = useState(
    stages[0].movingWall
  );
  const [flash, setFlash] = useState(false);
  const [scanUsed, setScanUsed] = useState(false);

  const playerMoveTimerRef = useRef<number | null>(null);

  const currentStage = stages[stageIndex];
  const totalCells = currentStage.size * currentStage.size;
  const isFinalStage = stageIndex === stages.length - 1;

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;

    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  };

  const unlockAudio = () => {
    const audioContext = getAudioContext();

    if (!audioContext) return;

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  };

  const primeSoundOnly = () => {
    const audioContext = getAudioContext();

    if (!audioContext) return;

    const playSilent = () => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.frequency.setValueAtTime(1, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.01);
    };

    if (audioContext.state === "suspended") {
      audioContext.resume().then(playSilent).catch(() => {});
    } else {
      playSilent();
    }
  };

  const playTone = (
    frequency: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.16
  ) => {
    const audioContext = getAudioContext();

    if (!audioContext) return;

    const play = () => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    };

    if (audioContext.state === "suspended") {
      audioContext.resume().then(play).catch(() => {});
    } else {
      play();
    }
  };

  const startBgm = () => {
    const audio = bgmAudioRef.current;

    if (!audio) return;

    audio.volume = 0.28;
    audio.loop = true;

    audio.play().catch(() => {});
  };

  const stopBgm = () => {
    const audio = bgmAudioRef.current;

    if (!audio) return;

    audio.pause();
  };

  const toggleBgm = () => {
    unlockAudio();

    setBgmEnabled((prev) => {
      const next = !prev;

      if (next) {
        startBgm();
        playTone(520, 0.08, "square", 0.12);
      } else {
        playTone(180, 0.1, "sawtooth", 0.12);
        stopBgm();
      }

      return next;
    });
  };

  const playMoveSound = () => {
    playTone(360, 0.06, "square", 0.13);
  };

  const playStartSound = () => {
    playTone(330, 0.08, "square", 0.14);
    window.setTimeout(() => playTone(520, 0.09, "square", 0.14), 90);
  };

  const playClearSound = () => {
    playTone(420, 0.08, "square", 0.14);
    window.setTimeout(() => playTone(620, 0.08, "square", 0.14), 90);
    window.setTimeout(() => playTone(880, 0.14, "square", 0.14), 180);
  };

  const playFailSound = () => {
    playTone(150, 0.14, "sawtooth", 0.17);
    window.setTimeout(() => playTone(85, 0.22, "sawtooth", 0.17), 130);
  };

  const playScanSound = () => {
    playTone(760, 0.05, "sine", 0.13);
    window.setTimeout(() => playTone(540, 0.07, "sine", 0.13), 70);
  };

  const triggerFlash = () => {
    setFlash(true);

    window.setTimeout(() => {
      setFlash(false);
    }, 150);
  };

  const triggerPlayerMove = useCallback(() => {
    setPlayerMoved(true);

    if (playerMoveTimerRef.current) {
      window.clearTimeout(playerMoveTimerRef.current);
    }

    playerMoveTimerRef.current = window.setTimeout(() => {
      setPlayerMoved(false);
      playerMoveTimerRef.current = null;
    }, 120);
  }, []);

  const setupStage = (targetStages: Stage[], nextStageIndex: number) => {
    const stage = targetStages[nextStageIndex];

    setStages(targetStages);
    setStageIndex(nextStageIndex);
    setPhase("memorize");
    setPlayerPosition(stage.playerStart);
    setPlayerMoved(false);
    setMessage(`${stage.name} / MEMORIZE THE GRID`);
    setCountdown(stage.memorizeSeconds);
    setMovingWallPosition(stage.movingWall);
    setFlash(false);
    setScanUsed(false);
  };

  const startGame = () => {
    unlockAudio();

    window.setTimeout(() => {
      playStartSound();
    }, 20);

    const newSeed = Date.now() + Math.floor(Math.random() * 999999);
    const newStages = generateStages(STAGE_COUNT, newSeed);

    setClearedStages([]);
    setupStage(newStages, 0);
  };

  const startFromStage = (targetStageIndex: number) => {
    unlockAudio();

    window.setTimeout(() => {
      playStartSound();
    }, 20);

    setupStage(stages, targetStageIndex);
  };

  const nextStage = useCallback(() => {
    unlockAudio();

    window.setTimeout(() => {
      playStartSound();
    }, 20);

    if (isFinalStage) {
      startGame();
      return;
    }

    setupStage(stages, stageIndex + 1);
  }, [isFinalStage, stageIndex, stages]);

  const goHome = () => {
    if (playerMoveTimerRef.current) {
      window.clearTimeout(playerMoveTimerRef.current);
      playerMoveTimerRef.current = null;
    }

    setPhase("title");
    setStageIndex(0);
    setPlayerPosition(stages[0].playerStart);
    setPlayerMoved(false);
    setMessage("READY");
    setCountdown(stages[0].memorizeSeconds);
    setMovingWallPosition(stages[0].movingWall);
    setFlash(false);
    setScanUsed(false);
  };

  const retryStageWithNewLayout = useCallback(() => {
    unlockAudio();

    window.setTimeout(() => {
      playStartSound();
    }, 20);

    const newSeed = Date.now() + Math.floor(Math.random() * 999999);
    const regeneratedStages = generateStages(STAGE_COUNT, newSeed);

    const updatedStages = stages.map((stage, index) => {
      if (index === stageIndex) {
        return regeneratedStages[index];
      }

      return stage;
    });

    setupStage(updatedStages, stageIndex);
  }, [stageIndex, stages]);

  const failGame = useCallback((reason: string) => {
    playFailSound();
    triggerFlash();
    setMessage(`${reason} / GAME OVER`);
    setPhase("failed");
  }, []);

  const getTargetObject = useCallback(
    (position: number): CellObject => {
      if (position === currentStage.goal) return "goal";
      if (position === movingWallPosition) return "movingWall";
      if (currentStage.walls.includes(position)) return "wall";

      return "empty";
    },
    [currentStage, movingWallPosition]
  );

  const movePlayer = useCallback(
    (direction: Direction) => {
      if (phase !== "hidden") return;

      triggerPlayerMove();

      const row = Math.floor(playerPosition / currentStage.size);
      const col = playerPosition % currentStage.size;

      let nextRow = row;
      let nextCol = col;

      if (direction === "up") nextRow -= 1;
      if (direction === "down") nextRow += 1;
      if (direction === "left") nextCol -= 1;
      if (direction === "right") nextCol += 1;

      if (
        nextRow < 0 ||
        nextRow >= currentStage.size ||
        nextCol < 0 ||
        nextCol >= currentStage.size
      ) {
        failGame("OUT OF GRID");
        return;
      }

      const nextPosition = nextRow * currentStage.size + nextCol;
      const targetObject = getTargetObject(nextPosition);

      if (targetObject === "wall" || targetObject === "movingWall") {
        failGame("WALL HIT");
        return;
      }

      if (targetObject === "goal") {
        playClearSound();

        setPlayerPosition(nextPosition);
        setPhase("clear");

        setClearedStages((prev) =>
          prev.includes(currentStage.id) ? prev : [...prev, currentStage.id]
        );

        if (isFinalStage) {
          setMessage("ALL LEVELS CLEARED");
        } else {
          setMessage("LEVEL CLEAR / PRESS ENTER");
        }

        return;
      }

      playMoveSound();
      setPlayerPosition(nextPosition);

      const normalMessages = [
        "STEP OK",
        "KEEP MEMORY",
        "GRID SILENT",
        "PATH CONFIRMED",
        "FOCUS",
      ];

      const randomMessage =
        normalMessages[Math.floor(Math.random() * normalMessages.length)];

      setMessage(randomMessage);
    },
    [
      phase,
      playerPosition,
      currentStage,
      isFinalStage,
      failGame,
      getTargetObject,
      triggerPlayerMove,
    ]
  );

  useEffect(() => {
    const unlockSoundOnly = () => {
      primeSoundOnly();
    };

    window.addEventListener("pointerdown", unlockSoundOnly, { once: true });
    window.addEventListener("keydown", unlockSoundOnly, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockSoundOnly);
      window.removeEventListener("keydown", unlockSoundOnly);
    };
  }, []);

  useEffect(() => {
    if (phase !== "memorize") return;

    const stage = currentStage;

    setCountdown(stage.memorizeSeconds);
    setMessage(`${stage.name} / ${stage.subtitle} / MEMORIZE`);

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 0.1);
        return Number(next.toFixed(1));
      });
    }, 100);

    const endTimer = window.setTimeout(() => {
      const shouldMoveWall = Math.random() < stage.movingWallMoveChance;

      setMovingWallPosition(
        shouldMoveWall ? stage.movingWallMoveTo : stage.movingWall
      );

      setPhase("hidden");

      if (shouldMoveWall) {
        setMessage("GRID HIDDEN / ONE WALL SHIFTED");
      } else {
        setMessage("GRID HIDDEN / TRUST MEMORY");
      }
    }, stage.memorizeSeconds * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(endTimer);
    };
  }, [phase, currentStage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (tagName === "input" || tagName === "textarea") return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        movePlayer("up");
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        movePlayer("down");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        movePlayer("left");
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        movePlayer("right");
      }

      if (event.code === "Space" && phase === "failed") {
        event.preventDefault();
        retryStageWithNewLayout();
      }

      if (event.key === "Enter" && phase === "clear") {
        event.preventDefault();
        nextStage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [movePlayer, phase, retryStageWithNewLayout, nextStage]);

  useEffect(() => {
    return () => {
      if (playerMoveTimerRef.current) {
        window.clearTimeout(playerMoveTimerRef.current);
      }

      stopBgm();

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getCellObject = (index: number): CellObject => {
    if (index === playerPosition) return "player";
    return getTargetObject(index);
  };

  const shouldShowCell = (index: number) => {
    if (phase === "memorize") return true;
    if (phase === "clear" || phase === "failed") return true;
    if (phase === "hidden" && index === playerPosition) return true;
    return false;
  };

  const scanGrid = () => {
    if (phase !== "hidden") return;

    if (scanUsed) {
      setMessage("SCAN USED");
      return;
    }

    playScanSound();
    setScanUsed(true);
    setMessage("SCAN: GOAL IS IN THE OPPOSITE CORNER");
  };

  const PixelButton = ({
    children,
    onClick,
    className = "",
  }: {
    children: ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={[
        "border border-neutral-500 bg-neutral-950 px-6 py-3 font-mono text-xs font-black uppercase tracking-[0.22em] text-neutral-100 shadow-[4px_4px_0_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 font-mono text-neutral-100">
      <audio ref={bgmAudioRef} src="/audio/bgm.mp3" preload="auto" loop />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:18px_18px]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%),linear-gradient(to_bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.85))]" />
      <div className="pointer-events-none fixed inset-0 z-0 scanline" />

      {flash && <div className="flash-layer" />}

      <div className="fixed right-3 top-3 z-50 flex gap-2">
        <button
          onClick={toggleBgm}
          className="border border-neutral-600 bg-neutral-950 px-3 py-2 font-mono text-[10px] font-black tracking-[0.2em] text-neutral-200 shadow-[3px_3px_0_rgba(255,255,255,0.16)] transition hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          BGM {bgmEnabled ? "ON" : "OFF"}
        </button>

        {phase !== "title" && (
          <button
            onClick={goHome}
            className="border border-neutral-600 bg-neutral-950 px-3 py-2 font-mono text-[10px] font-black tracking-[0.2em] text-neutral-200 shadow-[3px_3px_0_rgba(255,255,255,0.16)] transition hover:bg-neutral-800 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            HOME
          </button>
        )}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-4">
        {phase === "title" && (
          <section className="mono-window w-full max-w-3xl px-5 py-10 text-center sm:px-10">
            <p className="mb-5 text-[10px] font-black tracking-[0.45em] text-neutral-500">
              RANDOM MEMORY PUZZLE GAME
            </p>

            <div className="mb-6 border-y border-neutral-700 py-5">
              <h1 className="mono-title text-5xl font-black leading-none tracking-[-0.08em] text-neutral-50 sm:text-7xl">
                MEMORY
                <br />
                <span className="text-neutral-400">GRID</span>
              </h1>

              <p className="mt-3 text-xs font-black tracking-[0.35em] text-neutral-500">
                50 LEVELS / SOUND FX ON / BGM DEFAULT OFF
              </p>
            </div>

            <p className="mx-auto mb-8 max-w-md text-xs leading-7 text-neutral-300 sm:text-sm">
              START FROM A CORNER.
              <br />
              REACH THE OPPOSITE CORNER.
              <br />
              <span className="text-neutral-100">
                HIDDEN GRID HIDES EVERY TILE COMPLETELY.
              </span>
            </p>

            <PixelButton onClick={startGame} className="px-10 py-4 text-sm">
              GENERATE & START
            </PixelButton>

            <div className="mt-4">
              <PixelButton onClick={toggleBgm}>
                BGM {bgmEnabled ? "OFF" : "ON"}
              </PixelButton>
            </div>

            <div className="mx-auto mt-8 max-w-2xl border-t border-neutral-800 pt-6">
              <p className="mb-4 text-[10px] font-black tracking-[0.35em] text-neutral-500">
                LEVEL SELECT
              </p>

              <div className="grid max-h-[430px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {stages.map((stage, index) => {
                  const isCleared = clearedStages.includes(stage.id);
                  const routeOk = checkStageRoute(stage);

                  return (
                    <button
                      key={`${stage.id}-${stage.size}-${stage.goal}-${stage.walls.length}`}
                      onClick={() => startFromStage(index)}
                      className="group border border-neutral-800 bg-neutral-950 px-4 py-4 text-left font-mono shadow-[4px_4px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-neutral-900 active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-black tracking-[0.25em] text-neutral-200">
                          {stage.name}
                        </p>

                        <p className="text-[10px] font-black text-neutral-500">
                          {stage.size}×{stage.size}
                        </p>
                      </div>

                      <p className="text-[10px] font-black tracking-[0.2em] text-neutral-500">
                        {stage.subtitle}
                      </p>

                      <p className="mt-2 text-[10px] leading-5 text-neutral-600">
                        MEMORY TIME : {stage.memorizeSeconds}s / WALLS :{" "}
                        {stage.walls.length}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black tracking-[0.18em]">
                        <span
                          className={
                            isCleared ? "text-neutral-100" : "text-neutral-600"
                          }
                        >
                          {isCleared ? "CLEAR" : "UNCLEARED"}
                        </span>

                        <span
                          className={
                            routeOk ? "text-neutral-300" : "text-neutral-500"
                          }
                        >
                          ROUTE:{routeOk ? "OK" : "WARN"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-7 text-[10px] leading-6 text-neutral-600">
              SPACE: RETRY / ENTER: NEXT
              <br />
              MAX SIZE: 16×16.
            </p>
          </section>
        )}

        {(phase === "memorize" || phase === "hidden") && (
          <section className="w-full">
            <div className="mb-3 text-center">
              <p className="mb-2 text-[10px] font-black tracking-[0.45em] text-neutral-500">
                {currentStage.name} // {currentStage.subtitle}
              </p>

              <h2 className="text-2xl font-black tracking-tight text-neutral-100 sm:text-4xl">
                {phase === "memorize"
                  ? `MEMORIZE : ${countdown.toFixed(1)}`
                  : `HIDDEN GRID : ${currentStage.size}×${currentStage.size}`}
              </h2>

              <div className="mono-log mx-auto mt-3 min-h-12 max-w-xl px-4 py-2 text-left">
                <p className="mb-1 text-[10px] font-black tracking-[0.3em] text-neutral-500">
                  GRID LOG
                </p>
                <p className="text-xs leading-6 text-neutral-100 sm:text-sm">
                  {message}
                </p>
              </div>
            </div>

            <div className="mx-auto mb-3 grid w-full max-w-[620px] grid-cols-2 gap-2 text-center text-[10px] sm:text-xs">
              <div className="mono-status">
                <p className="mb-1 tracking-[0.25em] text-neutral-600">LEVEL</p>
                <p className="text-neutral-200">
                  {stageIndex + 1}/{stages.length}
                </p>
              </div>

              <div className="mono-status">
                <p className="mb-1 tracking-[0.25em] text-neutral-600">MODE</p>
                <p className="text-neutral-300">
                  {phase === "memorize" ? "VIEW" : "HIDE"}
                </p>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-5 lg:flex-row lg:items-center">
              <div
                className={[
                  "mono-grid grid aspect-square w-full p-2",
                  phase === "memorize"
                    ? "gap-[2px] grid-light"
                    : "gap-0 grid-dark hidden-grid",
                ].join(" ")}
                style={{
                  gridTemplateColumns: `repeat(${currentStage.size}, minmax(0, 1fr))`,
                  width: "min(82vw, 68vh, 620px)",
                  height: "min(82vw, 68vh, 620px)",
                }}
              >
                {Array.from({ length: totalCells }).map((_, index) => {
                  const object = getCellObject(index);
                  const visible = shouldShowCell(index);

                  return (
                    <div
                      key={index}
                      className={[
                        "mono-cell relative flex flex-col items-center justify-center overflow-hidden text-center",
                        phase === "memorize" ? "cell-light" : "cell-dark",
                        object === "wall" || object === "movingWall"
                          ? "wall-cell"
                          : "",
                        visible ? "opacity-100" : "hidden-cell",
                        object === "player" && phase === "hidden"
                          ? "player-cell"
                          : "",
                      ].join(" ")}
                    >
                      {visible ? (
                        <>
                          <div
                            className={[
                              "relative z-10 font-black leading-none",
                              currentStage.size >= 15
                                ? "text-xs sm:text-base"
                                : currentStage.size >= 12
                                  ? "text-sm sm:text-lg"
                                  : currentStage.size >= 9
                                    ? "text-lg sm:text-2xl"
                                    : "text-2xl sm:text-3xl",
                              object === "player" ? "player-dot" : "",
                              object === "goal" ? "goal-dot" : "",
                              playerMoved && object === "player"
                                ? "player-move"
                                : "",
                            ].join(" ")}
                          >
                            {objectSymbol[object]}
                          </div>

                          {currentStage.size <= 4 &&
                            object !== "wall" &&
                            object !== "movingWall" && (
                              <div className="relative z-10 mt-1 text-[8px] font-black tracking-[0.2em] text-neutral-500 sm:text-[10px]">
                                {objectLabels[object]}
                              </div>
                            )}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div
                className={[
                  "flex shrink-0 flex-col items-center justify-center gap-4 lg:w-[220px]",
                  phase === "hidden"
                    ? "opacity-100"
                    : "pointer-events-none opacity-0",
                ].join(" ")}
              >
                <div className="grid grid-cols-3 gap-2">
                  <div />

                  <button
                    onClick={() => movePlayer("up")}
                    className="mono-dpad"
                    tabIndex={phase === "hidden" ? 0 : -1}
                  >
                    ↑
                  </button>

                  <div />

                  <button
                    onClick={() => movePlayer("left")}
                    className="mono-dpad"
                    tabIndex={phase === "hidden" ? 0 : -1}
                  >
                    ←
                  </button>

                  <button
                    onClick={() => movePlayer("down")}
                    className="mono-dpad"
                    tabIndex={phase === "hidden" ? 0 : -1}
                  >
                    ↓
                  </button>

                  <button
                    onClick={() => movePlayer("right")}
                    className="mono-dpad"
                    tabIndex={phase === "hidden" ? 0 : -1}
                  >
                    →
                  </button>
                </div>

                <PixelButton onClick={scanGrid} className="mt-1">
                  SCAN
                </PixelButton>

                <p className="text-center text-[10px] leading-6 text-neutral-600">
                  ARROW KEYS AVAILABLE ON PC.
                  <br />
                  DO NOT TOUCH WALLS.
                </p>
              </div>
            </div>
          </section>
        )}

        {phase === "clear" && (
          <section className="mono-window w-full max-w-2xl px-5 py-10 text-center sm:px-10">
            <p className="mb-4 text-[10px] font-black tracking-[0.45em] text-neutral-400">
              {isFinalStage ? "ALL LEVELS CLEAR" : "LEVEL CLEAR"}
            </p>

            <h2 className="mb-6 text-4xl font-black text-neutral-50 sm:text-5xl">
              {isFinalStage ? "GAME CLEAR" : "CLEAR"}
            </h2>

            <p className="mb-8 text-xs leading-7 text-neutral-300 sm:text-sm">
              {message}
              <br />
              {isFinalStage
                ? "PRESS ENTER TO PLAY AGAIN."
                : "PRESS ENTER TO GO TO THE NEXT LEVEL."}
            </p>

            <PixelButton onClick={nextStage}>
              {isFinalStage ? "PLAY AGAIN" : "NEXT LEVEL"}
            </PixelButton>
          </section>
        )}

        {phase === "failed" && (
          <section className="mono-window w-full max-w-2xl px-5 py-10 text-center sm:px-10">
            <p className="mb-4 text-[10px] font-black tracking-[0.45em] text-neutral-500">
              FAILED
            </p>

            <h2 className="mb-6 text-4xl font-black text-neutral-50 sm:text-5xl">
              GRID FAILED
            </h2>

            <p className="mb-8 text-xs leading-7 text-neutral-300 sm:text-sm">
              {message}
              <br />
              PRESS SPACE TO RETRY WITH A NEW LAYOUT.
            </p>

            <PixelButton onClick={retryStageWithNewLayout}>
              RETRY LEVEL
            </PixelButton>

            <div className="mt-4">
              <PixelButton onClick={startGame}>GENERATE NEW GAME</PixelButton>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        .scanline {
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.025) 0px,
            rgba(255, 255, 255, 0.025) 1px,
            transparent 1px,
            transparent 5px
          );
        }

        .mono-window {
          border: 1px solid #737373;
          background:
            linear-gradient(rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.92)),
            #0a0a0a;
          box-shadow:
            8px 8px 0 rgba(255, 255, 255, 0.08),
            0 0 80px rgba(255, 255, 255, 0.08);
        }

        .mono-title {
          text-shadow:
            4px 4px 0 #404040,
            8px 8px 0 #000;
        }

        .mono-log {
          border: 1px solid #525252;
          background: #0a0a0a;
          box-shadow:
            inset 0 0 0 1px #171717,
            4px 4px 0 rgba(255, 255, 255, 0.08);
        }

        .mono-status {
          border: 1px solid #404040;
          background: #0a0a0a;
          padding: 8px 8px;
          font-weight: 900;
          box-shadow: 3px 3px 0 rgba(255, 255, 255, 0.08);
        }

        .mono-grid {
          border: 1px solid #737373;
          box-shadow:
            8px 8px 0 rgba(255, 255, 255, 0.08),
            0 0 70px rgba(255, 255, 255, 0.08);
        }

        .grid-light {
          background: #d4d4d4;
        }

        .grid-dark {
          background: #020202;
          animation: none;
        }

        .hidden-grid {
          background: #020202 !important;
          animation: none !important;
          box-shadow:
            8px 8px 0 rgba(255, 255, 255, 0.08),
            0 0 70px rgba(0, 0, 0, 0.9);
        }

        .hidden-grid .mono-cell {
          border: none !important;
          background: #020202 !important;
          box-shadow: none !important;
        }

        .mono-cell {
          aspect-ratio: 1 / 1;
          border: 1px solid #262626;
        }

        .cell-light {
          background:
            linear-gradient(45deg, rgba(0, 0, 0, 0.04) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(0, 0, 0, 0.04) 25%, transparent 25%),
            #e5e5e5;
          color: #0a0a0a;
        }

        .cell-dark {
          background: #020202;
          color: #f5f5f5;
        }

        .hidden-cell {
          opacity: 1 !important;
          background: #020202 !important;
          border: none !important;
          color: transparent !important;
          box-shadow: none !important;
        }

        .wall-cell {
          background: #000 !important;
          border-color: #000 !important;
          box-shadow: inset 0 0 0 1px #171717;
          color: transparent;
        }

        .hidden-grid .wall-cell {
          background: #020202 !important;
          border: none !important;
          box-shadow: none !important;
          color: transparent !important;
        }

        .player-cell {
          background: #020202 !important;
          border: none !important;
          box-shadow:
            inset 0 0 0 2px rgba(255, 255, 255, 0.18),
            0 0 28px rgba(255, 255, 255, 0.24) !important;
        }

        .player-dot {
          animation: playerIdle 1.2s steps(2) infinite;
        }

        .goal-dot {
          animation: goalPulse 1.8s steps(3) infinite;
        }

        .player-move {
          animation: playerMove 0.12s steps(2);
        }

        .mono-dpad {
          width: 58px;
          height: 58px;
          border: 1px solid #737373;
          background: #0a0a0a;
          color: #f5f5f5;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 4px 4px 0 rgba(255, 255, 255, 0.1);
          transition: 0.08s;
        }

        .mono-dpad:hover {
          background: #262626;
        }

        .mono-dpad:active {
          transform: translate(3px, 3px);
          box-shadow: none;
        }

        .flash-layer {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.18);
          animation: flashOut 0.15s steps(2) forwards;
        }

        @keyframes playerIdle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes playerMove {
          0% {
            transform: translate(0, 0);
            filter: blur(0);
          }
          50% {
            transform: translate(3px, -1px);
            filter: blur(1px);
          }
          100% {
            transform: translate(0, 0);
            filter: blur(0);
          }
        }

        @keyframes goalPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        @keyframes flashOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}