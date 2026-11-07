/**
 * Backward-compatible aggregate module.
 *
 * The implementation now lives in focused modules (cookie / color / dom /
 * image / misc / page). Keep importing from '~/utils/main' so existing call
 * sites keep working, and import the focused module directly in new code.
 */
export * from './color'
export * from './cookie'
export * from './dom'
export * from './image'
export * from './misc'
export * from './page'
