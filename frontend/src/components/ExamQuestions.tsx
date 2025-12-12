interface Question {
  id: number;
  text: string;
  option_a: string;
  option_b: string;
  option_c?: string;
  option_d?: string;
}

interface ExamQuestionsProps {
  questions: Question[];
}

const ExamQuestions = ({ questions }: ExamQuestionsProps) => {
  return (
    <>
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
    </>
  );
};

export default ExamQuestions;
