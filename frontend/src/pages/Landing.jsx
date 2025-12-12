import ExamLoginForm from "../components/ExamLoginForm";
import SummarizerEmailForm from "../components/SummarizerEmailForm";
import "../styles/landing.css";

const Landing = () => {
  return (
    <div className="landing-page">

      <div className="landing-wrapper">

        {/* Left floating box */}
        <div className="landing-box">
          <h2 className="landing-title">Exam Login</h2>
          <ExamLoginForm />
        </div>

        {/* Vertical Divider */}
        <div className="landing-divider"></div>

        {/* Right floating box */}
        <div className="landing-box">
          <h2 className="landing-title">Summarizer</h2>
          <SummarizerEmailForm />
        </div>

      </div>

    </div>
  );
};

export default Landing;
