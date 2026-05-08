import fs from 'fs'
import path from 'path'
import { N8nNodeInfo, SubResource } from '../types'

interface N8nWorkflow {
  name?: string
  nodes?: N8nNode[]
}

interface N8nNode {
  name: string
  type: string
  parameters?: Record<string, unknown>
  credentials?: Record<string, { id: string; name: string } | string>
}

export function isN8nWorkflow(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed.nodes) && parsed.nodes.length > 0
  } catch {
    return false
  }
}

export function parseN8nWorkflow(filePath: string): {
  nodes: N8nNodeInfo[]
  subResource: SubResource
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const workflow: N8nWorkflow = JSON.parse(content)

  const nodes: N8nNodeInfo[] = (workflow.nodes || []).map((node) => {
    const info: N8nNodeInfo = {
      type: node.type,
      name: node.name,
    }

    // Extract HTTP URLs from HTTP Request nodes
    const isHttp =
      node.type === 'n8n-nodes-base.httpRequest' ||
      node.type.toLowerCase().includes('httprequest')
    if (isHttp && node.parameters) {
      const urls: string[] = []
      if (node.parameters.url) urls.push(String(node.parameters.url))
      if (node.parameters.baseURL) urls.push(String(node.parameters.baseURL))
      if (urls.length) info.httpUrls = urls
    }

    // Extract credential type names
    if (node.credentials) {
      info.credentials = Object.keys(node.credentials)
    }

    return info
  })

  return {
    nodes,
    subResource: {
      name: workflow.name || path.basename(filePath, '.json'),
      path: filePath,
      type: 'workflow',
      description: `n8n workflow — ${nodes.length} nodes`,
    },
  }
}

export function findN8nWorkflows(repoPath: string): string[] {
  const results: string[] = []

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        if (isN8nWorkflow(full)) results.push(full)
      }
    }
  }

  walk(repoPath)
  return results
}
