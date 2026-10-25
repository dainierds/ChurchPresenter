$ErrorActionPreference = 'Stop'

$samplePath = [System.IO.Path]::GetFullPath("tests\fixtures\sample_presentation.pptx")
$benchPath = [System.IO.Path]::GetFullPath("tests\fixtures\benchmark_80_slides.pptx")

$ppt = New-Object -ComObject PowerPoint.Application

try {
    # 1. Generate 5-slide sample presentation with notes, transitions, animations
    Write-Output "Generating sample_presentation.pptx..."
    $p1 = $ppt.Presentations.Add(0)
    
    # Slide 1: Welcome with notes
    $s1 = $p1.Slides.Add(1, 1) # ppLayoutTitle
    $s1.Shapes.Title.TextFrame.TextRange.Text = "Bienvenida al Servicio"
    $s1.Shapes.Item(2).TextFrame.TextRange.Text = "Iglesia de la Comunidad"
    $s1.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = "Dar la bienvenida con entusiasmo a las visitas y pedir que apaguen los telefonos."
    
    # Slide 2: Praise
    $s2 = $p1.Slides.Add(2, 2) # ppLayoutText
    $s2.Shapes.Title.TextFrame.TextRange.Text = "Tiempo de Alabanza"
    $s2.Shapes.Item(2).TextFrame.TextRange.Text = "Canten con gozo al Senor toda la tierra.\nServid al Senor con alegria."
    
    # Slide 3: Announcements with notes
    $s3 = $p1.Slides.Add(3, 2)
    $s3.Shapes.Title.TextFrame.TextRange.Text = "Anuncios Comunitarios"
    $s3.Shapes.Item(2).TextFrame.TextRange.Text = "Reunion de jovenes el viernes a las 7:00 PM.\nEscuela dominical a las 10:00 AM."
    $s3.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = "Recordar llevar refrigerio para compartir despues de la reunion de jovenes."
    
    # Slide 4: Scripture Reading
    $s4 = $p1.Slides.Add(4, 2)
    $s4.Shapes.Title.TextFrame.TextRange.Text = "Lectura Biblica"
    $s4.Shapes.Item(2).TextFrame.TextRange.Text = "Filipenses 4:4-7\nRegocijaos en el Senor siempre."
    
    # Slide 5: Pastoral Blessing
    $s5 = $p1.Slides.Add(5, 1)
    $s5.Shapes.Title.TextFrame.TextRange.Text = "Bendicion Pastoral"
    $s5.Shapes.Item(2).TextFrame.TextRange.Text = "La gracia del Senor Jesucristo sea con vosotros."
    
    if (Test-Path $samplePath) { Remove-Item -Force $samplePath }
    $p1.SaveAs($samplePath)
    $p1.Close()
    Write-Output "Created: $samplePath (5 slides)"

    # 2. Generate 80-slide presentation for performance benchmark
    Write-Output "Generating benchmark_80_slides.pptx (80 slides)..."
    $p2 = $ppt.Presentations.Add(0)
    for ($i = 1; $i -le 80; $i++) {
        $s = $p2.Slides.Add($i, 2)
        $s.Shapes.Title.TextFrame.TextRange.Text = "Diapositiva del Sermon #$i"
        $s.Shapes.Item(2).TextFrame.TextRange.Text = "Punto doctrinal numero $i. Meditacion de las Sagradas Escrituras y aplicacion practica."
        if ($i % 5 -eq 0) {
            $s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = "Nota del predicador para diapositiva ${i}: enfatizar con tono solemne."
        }
    }
    if (Test-Path $benchPath) { Remove-Item -Force $benchPath }
    $p2.SaveAs($benchPath)
    $p2.Close()
    Write-Output "Created: $benchPath (80 slides)"
} finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    [System.GC]::Collect()
}
