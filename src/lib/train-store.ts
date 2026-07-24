/**
 * Learner model store (Upstash Redis). Mirrors profile-store.ts conventions:
 * lazy client, namespaced keys, simple rate limiting. One record per address
 * holds the learner's level, per-concept mastery, and lesson progress — this is
 * what makes training continuous instead of a one-off game.
 */

import { Redis } from '@upstash/redis'
import {
  type LearnerModel,
  type Concept,
  type LearnerLevel,
  emptyLearner,
} from '@/types/training'

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[train-store] Missing Upstash env vars')
  _redis = new Redis({ url, token })
  return _redis,
}

const K = {
  learner: (a: string) => `chess:train:learner:${a.toLowerCase()}`,
  rl: (a: string, action: string) => `chess:train:rl:${action}:${a.toLowerCase()}`,
}

function parse(raw: unknown): LearnerModel | null {
  if (!raw) return null
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as LearnerModel
}

export async function getLearner(address: string): Promise<LearnerModel | null> {
  return parse(await getRedis().get(K.learner(address)))
}

/** Get the learner, creating an empty record if none exists. */
export async function getOrCreateLearner(address: string, coachId?: string): Promise<LearnerModel> {
  const existing = await getLearner(address)
  if (existing) return existing
  const fresh = emptyLearner(address, coachId)
  await getRedis().set(K.learner(address), JSON.stringify(fresh))
  return fresh
}

export async function saveLearner(model: LearnerModel): Promise<void> {
  model.lastSession = new Date().toISOString()
  await getRedis().set(K.learner(model.address), JSON.stringify(model))
}

/**
 * Merge an update into the learner model. Concept mastery is clamped to 0..1
 * and merged (not replaced) so callers can update one concept at a time.
 */
export async function updateLearner(
  address: string,
  patch: {
    coachId?: string
    level?: LearnerLevel
    placed?: boolean
    concepts?: Partial<Record<Concept, number>>
    completedLesson?: string
  },
): Promise<LearnerModel> {
  const model = await getOrCreateLearner(address, patch.coachId)
  if (patch.coachId) model.coachId = patch.coachId
  if (patch.level) model.level = patch.level
  if (patch.placed !== undefined) model.placed = patch.placed
  if (patch.concepts) {
    for (const [c, v] of Object.entries(patch.concepts)) {
      if (v == null) continue
      model.concepts[c as Concept] = Math.max(0, Math.min(1, v))
    }
  }
  if (patch.completedLesson && !model.completedLessons.includes(patch.completedLesson)) {
    model.completedLessons.push(patch.completedLesson)
  }
  await saveLearner(model)
  return model
}

/**
 * Nudge a concept's mastery by a delta (e.g. +0.15 on a solved drill, -0.1 on a
 * blunder of that concept), clamped to 0..1. Returns the new value.
 */
export async function bumpConcept(address: string, concept: Concept, delta: number): Promise<number> {
  const model = await getOrCreateLearner(address)
  const next = Math.max(0, Math.min(1, (model.concepts[concept] ?? 0) + delta))
  model.concepts[concept] = next
  await saveLearner(model)
  return next
}

export async function checkRateLimit(
  address: string,
  action: string,
  limit: number,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis()
  const key = K.rl(address, action)
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, ttlSeconds)
  return count <= limit
}
