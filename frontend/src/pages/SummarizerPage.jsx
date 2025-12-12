import { useState } from "react";
import { useLocation } from "react-router-dom";
import client from "../api/axiosClient";
import "../styles/summarizerPage.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SummarizerPage = () => {
  const query = useQuery();
  const email = query.get("email") || "";
  const [text, setText] = useState("");
  const [tokens, setTokens] = useState(100);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    setLoading(true);
    setSummary("");
    try {
      const res = await client.post("/summarizer/summarize/", {
        email,
        text,
        tokens,
      });
      setSummary(res.data.summary);
    } catch (err) {
      setSummary("Error while summarizing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summarizer-page">
      <div className="summarizer-container">
        <div className="summarizer-header-row">
          <h2>Summarizer</h2>
          <button
            className="summarizer-home-btn"
            onClick={() => (window.location.href = "/")}
          >
            Home
          </button>
        </div>

        <p className="summarizer-email">
          Using email: <strong>{email}</strong>
        </p>

        <textarea
          className="summarizer-textarea"
          rows={10}
          placeholder="Paste your text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="summarizer-tokens">
          <label>
            Tokens: <span className="summarizer-tokens-value">{tokens}</span>
          </label>
          <input
            className="summarizer-slider"
            type="range"
            min={50}
            max={400}
            value={tokens}
            onChange={(e) => setTokens(Number(e.target.value))}
          />
        </div>

        <div className="summarizer-button-row">
          <button
            className="summarizer-button"
            onClick={handleSummarize}
            disabled={loading}
          >
            {loading ? "Summarizing..." : "Summarize"}
          </button>
        </div>

        {summary && (
          <div className="summarizer-output">
            <h3>Summary</h3>
            <p>{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummarizerPage;
