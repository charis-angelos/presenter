/**
 * @fileoverview Base type definitions for the Intelligent Presenter application.
 * 
 * This module contains core TypeScript interfaces and types that are used
 * throughout the application. It serves as a central hub for common data
 * structures and re-exports specialized types from other modules.
 * 
 * @author Technical Challenge
 * @version 1.0.0
 */

/**
 * Represents a Backlog project within the Intelligent Presenter system.
 * This interface defines the essential properties of a project that are
 * used for slide generation and presentation creation.
 * 
 * @interface Project
 * @property {string} id - Unique identifier for the project (from Backlog API)
 * @property {string} name - Human-readable project name
 * @property {string} [key] - Optional project key/code (e.g., "PROJ", "DEV")
 * @property {string} [description] - Optional project description
 * 
 * @example
 * ```typescript
 * const project: Project = {
 *   id: "216125",
 *   name: "Intelligent Presenter",
 *   key: "IP",
 *   description: "AI-powered presentation generation from Backlog data"
 * }
 * ```
 */
export interface Project {
  id: string
  name: string
  key?: string
  description?: string
}

/**
 * Re-export all authentication-related types from the auth module.
 * This includes user information, authentication responses, and OAuth interfaces.
 * 
 * @see {@link ./auth} for detailed authentication type definitions
 */
export * from './auth'

/**
 * Re-export all slide-related types from the slides module.
 * This includes slide content, generation requests, WebSocket messages, and more.
 * 
 * @see {@link ./slides} for detailed slide type definitions
 */
export * from './slides'