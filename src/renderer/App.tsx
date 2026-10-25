import React from 'react'
import { HashRouter, Routes, Route, useParams, Navigate } from 'react-router-dom'
import { OperatorApp } from './operator/OperatorApp'
import { OutputApp } from './output/OutputApp'

const OutputRouteWrapper: React.FC = () => {
  const { role } = useParams<{ role: string }>()
  return <OutputApp role={role || 'main'} />
}

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/operator" element={<OperatorApp />} />
        <Route path="/output/:role" element={<OutputRouteWrapper />} />
        <Route path="*" element={<Navigate to="/operator" replace />} />
      </Routes>
    </HashRouter>
  )
}
