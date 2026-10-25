import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { PowerPointService } from '../src/main/powerpoint/powerpoint-service'

describe('PowerPoint User Session Preservation', () => {
  const samplePptxPath = path.resolve(__dirname, 'fixtures/sample_presentation.pptx')
  let tempCacheDir: string
  let pptService: PowerPointService
  let userPptxPath: string
  let isPowerPointInstalled = false

  beforeEach(() => {
    tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-user-session-test-'))
    pptService = new PowerPointService(tempCacheDir)
    pptService.initialize()

    // Check if PowerPoint COM is available
    try {
      const checkPs = `
        try {
          $ppt = New-Object -ComObject PowerPoint.Application
          Write-Output "AVAILABLE"
        } catch {
          Write-Output "UNAVAILABLE"
        }
      `
      const out = execSync(`powershell -NoProfile -NonInteractive -Command "${checkPs}"`, { encoding: 'utf-8' })
      isPowerPointInstalled = out.includes('AVAILABLE')
    } catch {
      isPowerPointInstalled = false
    }

    if (isPowerPointInstalled) {
      // Create a temporary PPTX file that acts as the user's active presentation
      userPptxPath = path.join(tempCacheDir, 'user_active_work.pptx')
      fs.copyFileSync(samplePptxPath, userPptxPath)
    }
  })

  afterEach(() => {
    if (isPowerPointInstalled) {
      // Ensure any test-created user presentation is closed and PowerPoint is closed if appropriate
      try {
        const cleanupPs = `
          try {
            $ppt = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
            foreach ($p in $ppt.Presentations) {
              if ($p.FullName -like "*user_active_work.pptx*") {
                $p.Close()
              }
            }
          } catch {}
        `
        execSync(`powershell -NoProfile -NonInteractive -Command "${cleanupPs}"`, { stdio: 'ignore' })
      } catch {
        // ignore
      }
    }

    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('does NOT close or alter an existing open user presentation during import', async () => {
    if (!isPowerPointInstalled) {
      console.warn('PowerPoint is not installed on this environment; skipping user session test')
      return
    }

    // 1. Open the user's presentation using COM and add a unique marker in the title
    const openUserPresentationPs = `
      $ppt = New-Object -ComObject PowerPoint.Application
      $ppt.Visible = -1 # msoTrue
      $pres = $ppt.Presentations.Open('${userPptxPath.replace(/\\/g, '\\\\')}')
      # Add a marker text to slide 1
      $shape = $pres.Slides.Item(1).Shapes.AddTextbox(1, 50, 50, 500, 50)
      $shape.TextFrame.TextRange.Text = "USER_SESSION_ACTIVE_DO_NOT_TOUCH"
      $pres.Save()
      Write-Output "USER_PRES_OPENED"
    `
    const openResult = execSync(`powershell -NoProfile -NonInteractive -Command "${openUserPresentationPs}"`, {
      encoding: 'utf-8'
    })
    expect(openResult).toContain('USER_PRES_OPENED')

    // Verify PowerPoint is running with at least 1 open presentation
    const verifyBeforePs = `
      $ppt = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
      Write-Output "COUNT:$($ppt.Presentations.Count)"
    `
    const countBefore = execSync(`powershell -NoProfile -NonInteractive -Command "${verifyBeforePs}"`, {
      encoding: 'utf-8'
    })
    expect(countBefore).toContain('COUNT:1')

    // 2. Now perform ChurchPresenter import of a DIFFERENT presentation
    const manifest = await pptService.importPresentation(samplePptxPath)
    expect(manifest.slideCount).toBe(5)
    expect(manifest.slides.length).toBe(5)

    // 3. Verify that the user's presentation is STILL OPEN in PowerPoint and still has the marker!
    const verifyAfterPs = `
      $ppt = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
      $found = $false
      $hasMarker = $false
      foreach ($p in $ppt.Presentations) {
        if ($p.FullName -like "*user_active_work.pptx*") {
          $found = $true
          $text = $p.Slides.Item(1).Shapes.Item($p.Slides.Item(1).Shapes.Count).TextFrame.TextRange.Text
          if ($text -eq "USER_SESSION_ACTIVE_DO_NOT_TOUCH") {
            $hasMarker = $true
          }
        }
      }
      Write-Output "FOUND:$found;HAS_MARKER:$hasMarker;TOTAL:$($ppt.Presentations.Count)"
    `
    const verifyAfter = execSync(`powershell -NoProfile -NonInteractive -Command "${verifyAfterPs}"`, {
      encoding: 'utf-8'
    })
    expect(verifyAfter).toContain('FOUND:True')
    expect(verifyAfter).toContain('HAS_MARKER:True')
    expect(verifyAfter).toContain('TOTAL:1')
  })
})
