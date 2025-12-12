import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import ExamDashboard from './pages/ExamDashboard';
import SummarizerPage from './pages/SummarizerPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/exam" element={<ExamDashboard />} />
        <Route path="/summarizer" element={<SummarizerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
