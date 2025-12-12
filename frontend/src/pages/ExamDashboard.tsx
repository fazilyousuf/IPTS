// src/pages/ExamDashboard.tsx
import { useEffect, useState } from "react";
import client from "../api/axiosClient";
import WebcamProctor from "../components/WebcamProctor";
import AnomalyAlertBox from "../components/AnomalyAlertBox";
import "../styles/examDashboard.css";

interface Question {
  id: number;
  text: string;
  option_a: string;
  option_b: string;
  option_c?: string;
  option_d?: string;
}

const ExamDashboard: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    const initExam = async () => {
      try {
        const qRes = await client.get("/exams/questions/");
        setQuestions(qRes.data || []);
        const sRes = await client.post("/exams/start/");
        setSessionId(sRes.data.id);
      } catch (err) {
        console.error("initExam error", err);
      }
    };
    initExam();
  }, []);

  const handleNewAnomaly = (anomaly: any) => {
    setAnomalies((prev) => [anomaly, ...prev]);
  };

  if (!sessionId) return <p>Loading...</p>;

  return (
    <div className="exam-dashboard-root">
      <div className="exam-dashboard-content">
        <div className="exam-dashboard-header">
          <h2>Exam Dashboard</h2>

          <button
            className="exam-exit-button"
            onClick={() => {
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              window.location.href = "/"; // redirect to landing page
            }}
          >
            Exit
          </button>
        </div>

        <div className="exam-dashboard-layout">
          <div className="exam-questions-panel">
            <h3>Questions</h3>
            {questions.map((q) => (
              <div key={q.id} className="exam-question-card">
                <p>{q.text}</p>
                <ul>
                  <li>A. {q.option_a}</li>
                  <li>B. {q.option_b}</li>
                  {q.option_c && <li>C. {q.option_c}</li>}
                  {q.option_d && <li>D. {q.option_d}</li>}
                </ul>
              </div>
            ))}
          </div>

          <div className="exam-sidebar">
            {/* pass sessionId as number */}
            <WebcamProctor sessionId={sessionId} onAnomaly={handleNewAnomaly} />
            <AnomalyAlertBox anomalies={anomalies} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamDashboard;
