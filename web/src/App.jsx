import { Routes, Route, Navigate } from 'react-router-dom'
import { Pay } from './pages/Pay'
import { Success } from './pages/Success'
import { Cancel } from './pages/Cancel'

export function App() {
  return (
    <Routes>
      <Route path="/pay/:cartSessionId" element={<Pay />} />
      <Route path="/success" element={<Success />} />
      <Route path="/cancel" element={<Cancel />} />
      <Route path="*" element={<Navigate to="/cancel" replace />} />
    </Routes>
  )
}
