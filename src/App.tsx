import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import ActiveWorkout from './pages/ActiveWorkout'
import ExerciseDetail from './pages/ExerciseDetail'
import ExerciseLibrary from './pages/ExerciseLibrary'
import Profile from './pages/Profile'
import Progress from './pages/Progress'
import WorkoutBuilder from './pages/WorkoutBuilder'
import WorkoutList from './pages/WorkoutList'

function AppLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/exercises" replace />} />
        <Route path="exercises" element={<ExerciseLibrary />} />
        <Route path="exercises/:id" element={<ExerciseDetail />} />
        <Route path="workout/active" element={<ActiveWorkout />} />
        <Route path="workout/new" element={<WorkoutBuilder />} />
        <Route path="workout/:id" element={<WorkoutBuilder />} />
        <Route path="workout" element={<WorkoutList />} />
        <Route path="progress" element={<Progress />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/exercises" replace />} />
    </Routes>
  )
}
