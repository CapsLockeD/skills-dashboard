import fs from 'fs'
import path from 'path'
import { Registry, RegistryResource } from '../types'

const REGISTRY_PATH = path.join(process.cwd(), 'registry.config.json')

export function readRegistry(): Registry {
  const content = fs.readFileSync(REGISTRY_PATH, 'utf-8')
  return JSON.parse(content)
}

export function writeRegistry(registry: Registry): void {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n')
}

export function getResource(id: string): RegistryResource | null {
  return readRegistry().resources.find((r) => r.id === id) ?? null
}

export function upsertResource(resource: RegistryResource): void {
  const registry = readRegistry()
  const idx = registry.resources.findIndex((r) => r.id === resource.id)
  if (idx >= 0) {
    registry.resources[idx] = resource
  } else {
    registry.resources.push(resource)
  }
  writeRegistry(registry)
}
