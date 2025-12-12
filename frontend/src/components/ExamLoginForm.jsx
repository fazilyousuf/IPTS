import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/axiosClient';
import '../styles/examLoginForm.css';

const ExamLoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/accounts/login/', { username, password });
      const { access, refresh } = res.data;

      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      navigate('/exam');
    } catch (err) {
      setError(resErrorMessage(err));
    }
  };

  const resErrorMessage = (err) => {
    if (err?.response?.data?.detail) return err.response.data.detail;
    return 'Login failed';
  };

  return (
    <form className="exam-form" onSubmit={handleSubmit}>

      {/* Error */}
      {error && <div className="exam-error">{error}</div>}

      {/* Username */}
      <input
        className="exam-input"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      {/* Password */}
      <input
        className="exam-input"
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      {/* Button */}
      <button className="exam-button" type="submit">
        Login to Exam
      </button>
    </form>
  );
};

export default ExamLoginForm;
