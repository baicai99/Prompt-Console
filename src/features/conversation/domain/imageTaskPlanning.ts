import type { ImageTask } from '../../../types/conversation'
import { makeId } from '../../../utils/chat'
import type { PlannedRun } from './runPlanningTypes'

export function buildImageTasksForPlannedRuns(runPlans: PlannedRun[]): ImageTask[] {
  return runPlans.flatMap((plan) => {
    const createdAt = plan.pendingRun.createdAt
    return Array.from({ length: plan.pendingRun.imageCount }, (_, index) => {
      const seq = index + 1
      const taskId = makeId()
      const task: ImageTask = {
        taskId,
        runId: plan.pendingRun.id,
        batchId: plan.pendingRun.batchId,
        side: plan.pendingRun.side,
        seq,
        finalPrompt: plan.pendingRun.finalPrompt,
        status: 'queued',
        createdAt,
        queuedAt: createdAt,
        threadState: 'active',
      }
      plan.pendingRun.taskIds = [...(plan.pendingRun.taskIds ?? []), taskId]
      return task
    })
  })
}
