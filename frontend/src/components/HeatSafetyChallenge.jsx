import { useState, useEffect, useCallback } from "react";
import "./HeatSafetyChallenge.css";

const BACKEND_BASE = import.meta.env?.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function HeatSafetyChallenge() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("quiz"); // "quiz", "myths", "scenarios", "checklist", "sources"

  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState({});

  // Scenario state: { [scenarioId]: selectedOptionIndex }
  const [scenarioResponses, setScenarioResponses] = useState({});

  // Checklist state
  const [checklistItems, setChecklistItems] = useState({
    water_bottles: true,
    ors_packets: true,
    electrolyte_powder: true,
    instant_cold_packs: false,
    digital_thermometer: false,
    cooling_towel: true,
    wide_brimmed_hat: true,
    sunscreen_spf30: false,
  });

  const toggleChecklist = (key) => {
    setChecklistItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllChecklist = () => {
    setChecklistItems((prev) => {
      const allChecked = Object.values(prev).every(Boolean);
      const updated = {};
      Object.keys(prev).forEach((k) => {
        updated[k] = !allChecked;
      });
      return updated;
    });
  };

  const loadQuizData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/heat-safety-quizzes`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch heat safety data:", err);
      setError("Failed to load heat safety challenge data. Please verify backend connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizData();
  }, [loadQuizData]);

  // Support both canonical frontend keys and backend legacy keys
  const quizQuestions = data?.quiz_questions || data?.quizzes || [];
  const mythsVsFacts = data?.myths_vs_facts || data?.myths_and_facts || [];
  const scenarioChallenges = data?.scenario_challenges || [];
  const evidenceSources = data?.evidence_sources || data?.authoritative_sources || [];

  const currentQ = quizQuestions[currentQuestionIndex];
  const totalQuestions = quizQuestions.length;
  const maxScore = totalQuestions * 20;

  const handleSelectOption = (idx) => {
    if (selectedOption !== null || !currentQ) return;
    setSelectedOption(idx);
    const isCorrect = idx === currentQ.correct_index;
    if (isCorrect) {
      setQuizScore((prev) => prev + 20);
    }
    setAnsweredQuestions((prev) => ({
      ...prev,
      [currentQuestionIndex]: { selected: idx, isCorrect },
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < totalQuestions) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setQuizScore(0);
    setQuizCompleted(false);
    setAnsweredQuestions({});
  };

  const handleScenarioSelect = (scenarioId, optionIdx) => {
    setScenarioResponses((prev) => ({ ...prev, [scenarioId]: optionIdx }));
  };

  const completedChecklistCount = Object.values(checklistItems).filter(Boolean).length;
  const totalChecklistCount = Object.keys(checklistItems).length;

  const correctAnswersCount = Object.values(answeredQuestions).filter((q) => q.isCorrect).length;
  const scorePercent = maxScore > 0 ? Math.round((quizScore / maxScore) * 100) : 0;

  return (
    <div className="hsc-container">
      {/* ── HEADER & PROGRESS STATS ── */}
      <div className="hsc-header">
        <div className="hsc-header-top">
          <div className="hsc-title-group">
            <h2>🏆 Heat Safety Challenge & Awareness Center</h2>
            <p className="hsc-subtitle">
              Interactive evidence-based heat safety training. Test your knowledge against common myths,
              solve tactical crisis scenarios, master emergency preparedness checklists, and inspect authoritative guidelines.
            </p>
          </div>
          <div className="hsc-score-badge">
            <span className="hsc-score-val">{quizScore} PTS</span>
            <span className="hsc-score-label">Knowledge Score</span>
          </div>
        </div>

        <div className="hsc-disclaimer">
          <strong>⚠️ Educational Notice:</strong> Information presented in this module is compiled directly from
          guidelines published by the World Health Organization (WHO), National Disaster Management Authority (NDMA),
          and US CDC/NIOSH. This interactive educational tool does not replace professional medical diagnosis or clinical treatment.
        </div>
      </div>

      {/* ── MODULE TABS ── */}
      <div className="hsc-tabs">
        <button
          type="button"
          className={`hsc-tab-btn ${activeTab === "quiz" ? "active" : ""}`}
          onClick={() => setActiveTab("quiz")}
        >
          🧠 Heat Safety Quiz {totalQuestions > 0 ? `(${totalQuestions})` : ""}
        </button>
        <button
          type="button"
          className={`hsc-tab-btn ${activeTab === "myths" ? "active" : ""}`}
          onClick={() => setActiveTab("myths")}
        >
          🔄 Myth vs. Fact Cards ({mythsVsFacts.length})
        </button>
        <button
          type="button"
          className={`hsc-tab-btn ${activeTab === "scenarios" ? "active" : ""}`}
          onClick={() => setActiveTab("scenarios")}
        >
          🚨 Crisis Scenarios ({scenarioChallenges.length})
        </button>
        <button
          type="button"
          className={`hsc-tab-btn ${activeTab === "checklist" ? "active" : ""}`}
          onClick={() => setActiveTab("checklist")}
        >
          ✅ Safety Checklist ({completedChecklistCount}/{totalChecklistCount})
        </button>
        <button
          type="button"
          className={`hsc-tab-btn ${activeTab === "sources" ? "active" : ""}`}
          onClick={() => setActiveTab("sources")}
        >
          📚 Evidence Sources ({evidenceSources.length})
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      {loading ? (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔄</div>
          <p style={{ color: "var(--text)", fontWeight: 600 }}>Loading verified safety challenges & evidence repository...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: "30px", textAlign: "center", border: "1px solid var(--danger)" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚠️</div>
          <h3 style={{ color: "var(--danger)", marginBottom: "8px" }}>Service Connection Error</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "18px" }}>{error}</p>
          <button type="button" className="hsc-primary-btn" onClick={loadQuizData}>
            🔄 Retry Loading
          </button>
        </div>
      ) : (
        <>
          {/* ── TAB 1: INTERACTIVE QUIZ ── */}
          {activeTab === "quiz" && (
            <div className="hsc-quiz-card">
              {totalQuestions === 0 ? (
                /* Empty Questions Fallback - Never show Quiz Completed 0/0 */
                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>📋</div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>
                    No Quiz Questions Available
                  </h3>
                  <p style={{ color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 18px auto" }}>
                    The heat safety challenge questions could not be loaded at this time.
                  </p>
                  <button type="button" className="hsc-primary-btn" onClick={loadQuizData}>
                    🔄 Refresh Question Bank
                  </button>
                </div>
              ) : !quizCompleted && currentQ ? (
                /* In-Progress Quiz State */
                <>
                  <div className="hsc-quiz-meta">
                    <span>
                      Question {currentQuestionIndex + 1} of {totalQuestions}
                      {currentQ.category && (
                        <span style={{
                          marginLeft: "10px",
                          fontSize: "11px",
                          background: "var(--secondary)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          color: "var(--primary)"
                        }}>
                          {currentQ.category}
                        </span>
                      )}
                    </span>
                    <span>Current Score: {quizScore} / {maxScore}</span>
                  </div>

                  <div className="hsc-progress-track">
                    <div
                      className="hsc-progress-fill"
                      style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                    />
                  </div>

                  <div className="hsc-question-text">{currentQ.question}</div>

                  <div className="hsc-options-list">
                    {currentQ.options.map((opt, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = idx === currentQ.correct_index;
                      let btnClass = "hsc-option-btn";
                      if (selectedOption !== null) {
                        if (isCorrect) btnClass += " correct";
                        else if (isSelected) btnClass += " wrong";
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={btnClass}
                          disabled={selectedOption !== null}
                          onClick={() => handleSelectOption(idx)}
                        >
                          <span>{opt}</span>
                          {selectedOption !== null && (
                            <span>{isCorrect ? "✓" : isSelected ? "✗" : ""}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (
                    <div className="hsc-explanation-box">
                      <div className="hsc-explanation-title">
                        {selectedOption === currentQ.correct_index ? (
                          <span style={{ color: "var(--success)" }}>✓ Correct! Evidence-Based Rationale:</span>
                        ) : (
                          <span style={{ color: "var(--danger)" }}>✗ Incorrect. Evidence-Based Rationale:</span>
                        )}
                      </div>
                      <p className="hsc-explanation-text">{currentQ.explanation}</p>
                      <span className="hsc-citation-tag">
                        Citation: {currentQ.source_citation || currentQ.source || "Official Public Health Guidelines"}
                      </span>
                    </div>
                  )}

                  <div className="hsc-quiz-actions">
                    {selectedOption !== null && (
                      <button
                        type="button"
                        className="hsc-primary-btn"
                        onClick={handleNextQuestion}
                      >
                        {currentQuestionIndex + 1 < totalQuestions ? "Next Question ➔" : "View Final Results ➔"}
                      </button>
                    )}
                  </div>
                </>
              ) : quizCompleted ? (
                /* Completed State */
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
                  <h3 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)" }}>
                    Heat Safety Challenge Completed!
                  </h3>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--primary)", margin: "16px 0" }}>
                    {quizScore} / {maxScore} Points
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
                    Result: {correctAnswersCount} of {totalQuestions} questions answered correctly ({scorePercent}%)
                  </p>
                  <p style={{ color: "var(--text-muted)", maxWidth: "520px", margin: "0 auto 24px auto", lineHeight: "1.5" }}>
                    {scorePercent >= 80
                      ? "Outstanding! You demonstrate exceptional mastery of official clinical and occupational heat safety protocols."
                      : scorePercent >= 60
                      ? "Good effort! Review the detailed rationales, Myth vs Fact cards, and disaster guidance to solidify your heat resilience knowledge."
                      : "Keep practicing! Review the Myth vs Fact cards and evidence guidelines below to prepare for high-temperature events."}
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                    <button type="button" className="hsc-primary-btn" onClick={handleRestartQuiz}>
                      🔄 Retake Heat Safety Quiz
                    </button>
                    <button
                      type="button"
                      className="hsc-primary-btn"
                      style={{ background: "var(--secondary)", color: "var(--text)", border: "1px solid var(--border)" }}
                      onClick={() => setActiveTab("myths")}
                    >
                      Inspect Myth vs Fact Cards ➔
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ── TAB 2: MYTH VS FACT CARDS ── */}
          {activeTab === "myths" && (
            <div className="hsc-myths-grid">
              {mythsVsFacts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                  No myth vs. fact cards currently available.
                </div>
              ) : (
                mythsVsFacts.map((item) => (
                  <div key={item.id} className="hsc-myth-card">
                    <div className="hsc-myth-section">
                      <span className="hsc-myth-label">❌ Common Myth</span>
                      <p className="hsc-myth-text">&ldquo;{item.myth}&rdquo;</p>
                    </div>

                    <div className="hsc-fact-section">
                      <span className="hsc-fact-label">✓ Scientific Fact</span>
                      <p className="hsc-fact-text">{item.fact}</p>
                    </div>

                    {(item.science_detail || item.explanation) && (
                      <div className="hsc-science-detail">
                        {item.science_detail || item.explanation}
                      </div>
                    )}

                    <span className="hsc-card-source">
                      Authority: {item.source || item.authority || "World Health Organization & NDMA"}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TAB 3: SCENARIO CHALLENGES ── */}
          {activeTab === "scenarios" && (
            <div className="hsc-scenarios-list">
              {scenarioChallenges.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                  No crisis scenarios currently available.
                </div>
              ) : (
                scenarioChallenges.map((sc) => {
                  const userChoice = scenarioResponses[sc.id];
                  const hasOptions = Array.isArray(sc.options) && sc.options.length > 0;
                  return (
                    <div key={sc.id} className="hsc-scenario-box">
                      <h3 className="hsc-scenario-title">
                        <span>🚨</span>
                        <span>{sc.title}</span>
                      </h3>

                      <div className="hsc-scenario-prompt">
                        <strong>Scenario Context:</strong> {sc.scenario}
                      </div>

                      {hasOptions ? (
                        <>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                            Choose your immediate tactical response:
                          </div>

                          <div className="hsc-scenario-options">
                            {sc.options.map((opt, oIdx) => {
                              const isChosen = userChoice === oIdx;
                              let btnClass = "hsc-scenario-btn";
                              if (userChoice !== undefined) {
                                if (opt.is_correct) btnClass += " selected-correct";
                                else if (isChosen) btnClass += " selected-wrong";
                              }
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  className={btnClass}
                                  disabled={userChoice !== undefined}
                                  onClick={() => handleScenarioSelect(sc.id, oIdx)}
                                >
                                  <span>{opt.text}</span>
                                </button>
                              );
                            })}
                          </div>

                          {userChoice !== undefined && sc.options[userChoice] && (
                            <div className="hsc-scenario-feedback">
                              <strong style={{
                                color: sc.options[userChoice].is_correct ? "var(--success)" : "var(--danger)",
                                display: "block",
                                marginBottom: "4px"
                              }}>
                                {sc.options[userChoice].outcome}
                              </strong>
                              <p style={{ margin: "4px 0", color: "var(--text-muted)" }}>
                                {sc.options[userChoice].explanation}
                              </p>
                              {sc.guidance && (
                                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--border)", fontSize: "12px" }}>
                                  <strong>Expert Medical Protocol:</strong> {sc.guidance}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : Array.isArray(sc.steps) && sc.steps.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <strong style={{ fontSize: "13px" }}>Action Steps:</strong>
                          {sc.steps.map((st, sIdx) => (
                            <div key={sIdx} style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                              <strong>{st.step}:</strong> {st.action}
                            </div>
                          ))}
                          {sc.key_takeaway && (
                            <div style={{ fontSize: "12px", color: "var(--primary)", marginTop: "6px" }}>
                              <strong>Key Takeaway:</strong> {sc.key_takeaway}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB 4: SAFETY CHECKLIST ── */}
          {activeTab === "checklist" && (
            <div className="scpp-sliders-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <div className="hsc-quiz-card" style={{ gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                    🎒 Household Heat Emergency Go-Bag Kit
                  </h3>
                  <button
                    type="button"
                    onClick={handleSelectAllChecklist}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {Object.values(checklistItems).every(Boolean) ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Essential readiness items recommended by NDMA and WHO for high-heatwaves ({completedChecklistCount}/{totalChecklistCount} checked):
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.water_bottles}
                      onChange={() => toggleChecklist("water_bottles")}
                    />
                    <span>At least 3 Liters of potable water per family member per day</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.ors_packets}
                      onChange={() => toggleChecklist("ors_packets")}
                    />
                    <span>WHO-standard Oral Rehydration Salts (ORS) sachets</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.electrolyte_powder}
                      onChange={() => toggleChecklist("electrolyte_powder")}
                    />
                    <span>Backup electrolyte powder / hydration replenishment packets</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.instant_cold_packs}
                      onChange={() => toggleChecklist("instant_cold_packs")}
                    />
                    <span>Instant chemical cold compress packs for rapid cooling</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.digital_thermometer}
                      onChange={() => toggleChecklist("digital_thermometer")}
                    />
                    <span>Digital oral/axillary thermometer for core temperature monitoring</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.cooling_towel}
                      onChange={() => toggleChecklist("cooling_towel")}
                    />
                    <span>Evaporative cooling towel or damp cotton wraps</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.wide_brimmed_hat}
                      onChange={() => toggleChecklist("wide_brimmed_hat")}
                    />
                    <span>Wide-brimmed cotton hat and UV400 protective sunglasses</span>
                  </label>
                  <label className="herc-check-item">
                    <input
                      type="checkbox"
                      checked={checklistItems.sunscreen_spf30}
                      onChange={() => toggleChecklist("sunscreen_spf30")}
                    />
                    <span>Broad-spectrum Sunscreen (SPF 30+ / PA+++)</span>
                  </label>
                </div>
              </div>

              <div className="hsc-quiz-card" style={{ gap: "14px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                  📋 Daily High-Heat Behavioral Protocol
                </h3>
                <ul style={{ paddingLeft: "18px", fontSize: "13px", lineHeight: "1.6", color: "var(--text)" }}>
                  <li><strong>Peak Hours Curfew:</strong> Avoid direct outdoor exposure between 12:00 PM and 3:30 PM.</li>
                  <li><strong>Hydration Discipline:</strong> Drink small quantities of water every 20-30 minutes, even if not thirsty.</li>
                  <li><strong>Electrolyte Balance:</strong> Complement pure water with lemon water, buttermilk, tender coconut, or ORS.</li>
                  <li><strong>Vulnerable Check:</strong> Visually inspect elderly relatives twice daily for cognitive changes or lethargy.</li>
                  <li><strong>Vehicle Safety:</strong> Never leave children or pets inside parked vehicles, even for a few minutes with windows cracked.</li>
                  <li><strong>Active Cooling:</strong> Sponge skin with cool water or take cold showers if feeling faint or overheated.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── TAB 5: EVIDENCE SOURCES ── */}
          {activeTab === "sources" && (
            <div className="hsc-sources-grid">
              {evidenceSources.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                  No evidence sources currently available.
                </div>
              ) : (
                evidenceSources.map((src, idx) => (
                  <div key={idx} className="hsc-source-card">
                    <span style={{ fontSize: "24px" }}>🏛️</span>
                    <h4 className="hsc-source-name">{src.organization || src.name}</h4>
                    <span className="hsc-source-pub">
                      {src.publication ? `${src.publication} (${src.year || 2024})` : src.name}
                    </span>
                    <p className="hsc-source-desc">{src.description || "Official evidence-based heat health guidance."}</p>
                    <a href={src.url} target="_blank" rel="noreferrer" className="hsc-source-link">
                      Official Document Reference ➔
                    </a>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
