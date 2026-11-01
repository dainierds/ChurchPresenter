import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { WorkspaceService, WORKSPACE_SUBFOLDERS } from '../src/main/workspace/workspace-service'
import { DatabaseService } from '../src/main/db/database-service'

describe('WorkspaceService', () => {
  let tempBaseDir: string
  let dbService: DatabaseService
  let service: WorkspaceService

  beforeEach(async () => {
    tempBaseDir = path.join(os.tmpdir(), `cp_workspace_test_${Date.now()}`)
    fs.mkdirSync(tempBaseDir, { recursive: true })

    const testDbPath = path.join(tempBaseDir, 'test_church_presenter.sqlite')
    dbService = new DatabaseService(testDbPath)
    await dbService.initialize()

    service = new WorkspaceService(dbService)
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tempBaseDir)) {
        fs.rmSync(tempBaseDir, { recursive: true, force: true })
      }
    } catch {
      // ignore
    }
  })

  it('creates the root directory and all standard section subfolders on ensureWorkspaceFolders', () => {
    const targetWorkspace = path.join(tempBaseDir, 'ChurchPresenterTest')
    const info = service.ensureWorkspaceFolders(targetWorkspace)

    expect(info.rootPath).toBe(targetWorkspace)
    expect(info.subfolders).toEqual([...WORKSPACE_SUBFOLDERS])
    expect(fs.existsSync(targetWorkspace)).toBe(true)

    // Verify all 10 subfolders exist
    for (const folder of WORKSPACE_SUBFOLDERS) {
      const fullPath = path.join(targetWorkspace, folder)
      expect(fs.existsSync(fullPath)).toBe(true)

      // Verify _LEAME.txt is created
      const readmePath = path.join(fullPath, '_LEAME.txt')
      expect(fs.existsSync(readmePath)).toBe(true)
      const content = fs.readFileSync(readmePath, 'utf-8')
      expect(content).toContain(folder)
    }
  })

  it('updates configured workspace directory and automatically creates subfolders in new path', () => {
    const customWorkspace = path.join(tempBaseDir, 'CustomUserMediaDir')
    const res = service.setWorkspacePath(customWorkspace)

    expect(res.rootPath).toBe(path.resolve(customWorkspace))
    expect(service.getWorkspacePath()).toBe(path.resolve(customWorkspace))
    expect(fs.existsSync(customWorkspace)).toBe(true)

    // Verify subfolders created in custom directory
    for (const folder of WORKSPACE_SUBFOLDERS) {
      expect(fs.existsSync(path.join(customWorkspace, folder))).toBe(true)
    }

    // Verify persisted in database
    const savedConfig = dbService.getConfig('user_workspace_directory')
    expect(savedConfig).toBe(path.resolve(customWorkspace))
  })
})
