const ExamInstructions = () => {
  return (
    <div className="exam-question-card">
      <h3 className="exam-instructions-title">Before you begin</h3>
      <ul className="exam-instructions-list">
        <li>Ensure your camera is turned on and your face is clearly visible.</li>
        <li>Sit in a quiet, well-lit environment without other people in frame.</li>
        <li>Keep your mobile phone and other devices away from your desk.</li>
        <li>Do not switch tabs or windows during the exam.</li>
        <li>Any suspicious activity will be logged as an anomaly.</li>
      </ul>
      <p className="exam-instructions-note">
        Click <strong>Start</strong> on the Live Camera to begin the exam and reveal the questions.
      </p>
    </div>
  );
};

export default ExamInstructions;
