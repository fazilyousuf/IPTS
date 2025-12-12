import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/summarizerForm.css';

const SummarizerEmailForm = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleNext = (e) => {
    e.preventDefault();
    if (!email) return;
    navigate(`/summarizer?email=${encodeURIComponent(email)}`);
  };

  return (
    <form className="summarizer-form" onSubmit={handleNext}>
      <input
        className="summarizer-input"
        placeholder="Enter your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <button className="landing-summarizer-button" type="submit">
        Next
      </button>
    </form>
  );
};

export default SummarizerEmailForm;
