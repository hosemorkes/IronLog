import type { WorkoutExercise } from '../types'

export type WorkoutBlock = {
  items: WorkoutExercise[]
  startExerciseIndex: number
  isSuperset: boolean
}

export function buildWorkoutBlocks(exercises: WorkoutExercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = []
  let i = 0
  while (i < exercises.length) {
    const g = exercises[i].supersetGroup
    if (!g) {
      blocks.push({ items: [exercises[i]], startExerciseIndex: i, isSuperset: false })
      i++
      continue
    }
    let j = i
    while (j < exercises.length && exercises[j].supersetGroup === g) j++
    const chunk = exercises.slice(i, j)
    const isSuperset = chunk.length >= 2
    blocks.push({ items: chunk, startExerciseIndex: i, isSuperset })
    i = j
  }
  return blocks
}

export type WorkoutStep = {
  weId: string
  exerciseIndex: number
  setIndex: number
  globalIndex: number
}

/** Плоский порядок: одиночные упражнения подряд; суперсет — чередование раундов (A1,B1,A2,B2…) */
export function buildWorkoutSteps(exercises: WorkoutExercise[]): WorkoutStep[] {
  const blocks = buildWorkoutBlocks(exercises)
  const steps: WorkoutStep[] = []
  let globalIndex = 0
  for (const block of blocks) {
    const { items, isSuperset } = block
    if (!isSuperset) {
      const we = items[0]
      const exerciseIndex = exercises.findIndex((e) => e.id === we.id)
      for (let s = 0; s < we.sets.length; s++) {
        steps.push({ weId: we.id, exerciseIndex, setIndex: s, globalIndex: globalIndex++ })
      }
      continue
    }
    const maxRounds = Math.max(1, ...items.map((we) => we.sets.length))
    for (let r = 0; r < maxRounds; r++) {
      for (const we of items) {
        if (r < we.sets.length) {
          const exerciseIndex = exercises.findIndex((e) => e.id === we.id)
          steps.push({ weId: we.id, exerciseIndex, setIndex: r, globalIndex: globalIndex++ })
        }
      }
    }
  }
  return steps
}

/** Отдых после завершения шага с индексом stepGlobalIndex (последний шаг — без отдыха) */
export function getRestAfterStep(
  exercises: WorkoutExercise[],
  steps: WorkoutStep[],
  stepGlobalIndex: number,
): { show: boolean; seconds: number } {
  if (stepGlobalIndex < 0 || stepGlobalIndex >= steps.length) return { show: false, seconds: 0 }
  if (stepGlobalIndex === steps.length - 1) return { show: false, seconds: 0 }

  const step = steps[stepGlobalIndex]
  const blocks = buildWorkoutBlocks(exercises)
  const block = blocks.find((b) => b.items.some((we) => we.id === step.weId))
  if (!block) return { show: false, seconds: 0 }

  if (!block.isSuperset) {
    const we = exercises[step.exerciseIndex]
    return { show: true, seconds: we.restSeconds }
  }

  const r = step.setIndex
  const itemsWithRound = block.items.filter((we) => r < we.sets.length)
  const lastWeInRound = itemsWithRound[itemsWithRound.length - 1]
  if (step.weId !== lastWeInRound.id) {
    return { show: false, seconds: 0 }
  }

  const restFrom = block.items[block.items.length - 1]
  return { show: true, seconds: restFrom.restSeconds }
}
