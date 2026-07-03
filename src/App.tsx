import { useEffect, useMemo, useRef, useState } from "react";
import {
  child,
  get,
  onValue,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { db, loginAnonymously } from "./firebase";
import type { GameState, QuizQuestion, ResponseItem, Student } from "./types";
import { playSound } from "./sound";
import { CheckCircle2, Circle, Trophy, Users, RotateCcw, Play, Eye, SkipForward } from "lucide-react";

const GAME_PATH = "game";

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAnswer(value: string): "O" | "X" | null {
  const v = value.trim().toUpperCase();
  if (["O", "TRUE", "T", "맞음", "참", "YES", "Y", "1"].includes(v)) return "O";
  if (["X", "FALSE", "F", "틀림", "거짓", "NO", "N", "0"].includes(v)) return "X";
  return null;
}

function parseQuestions(input: string): QuizQuestion[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questions: QuizQuestion[] = [];

  lines.forEach((line, index) => {
    let cols = line.split("\t").map((v) => v.trim());

    if (cols.length < 2) {
      cols = line.split(",").map((v) => v.trim());
    }

    if (index === 0) {
      const header = cols.join(" ");
      if (header.includes("문제") && header.includes("정답")) return;
    }

    const text = cols[0] || "";
    const answer = normalizeAnswer(cols[1] || "");
    const explanation = cols.slice(2).join(" ").trim();

    if (text && answer) {
      questions.push({
        id: createId("q"),
        text,
        answer,
        explanation,
      });
    }
  });

  return questions;
}

function getQuestionList(game: GameState | null): QuizQuestion[] {
  if (!game?.questions || !game.questionOrder) return [];
  return game.questionOrder
    .map((id) => game.questions?.[id])
    .filter(Boolean) as QuizQuestion[];
}

function currentQuestion(game: GameState | null): QuizQuestion | null {
  const list = getQuestionList(game);
  return list[game?.currentQuestionIndex ?? 0] || null;
}

function getResponsesForCurrent(game: GameState | null): ResponseItem[] {
  const q = currentQuestion(game);
  if (!q || !game?.responses?.[q.id]) return [];
  return Object.values(game.responses[q.id]);
}

function getStudents(game: GameState | null): Student[] {
  if (!game?.students) return [];
  return Object.values(game.students).sort((a, b) => a.joinedAt - b.joinedAt);
}

function getRanking(game: GameState | null): Student[] {
  return getStudents(game).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt - b.joinedAt;
  });
}

function emitSound(type: NonNullable<GameState["soundEvent"]>["type"]) {
  return set(ref(db, `${GAME_PATH}/soundEvent`), {
    type,
    timestamp: Date.now(),
  });
}

function AdminApp({ game }: { game: GameState | null }) {
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");

  const questions = getQuestionList(game);
  const question = currentQuestion(game);
  const students = getStudents(game);
  const responses = getResponsesForCurrent(game);
  const ranking = getRanking(game);

  const oCount = responses.filter((r) => r.answer === "O").length;
  const xCount = responses.filter((r) => r.answer === "X").length;

  async function loadQuestions() {
    const parsed = parseQuestions(pasteText);
    if (parsed.length === 0) {
      setMessage("인식된 문제가 없습니다. 문제 / 정답 형식을 확인하세요.");
      return;
    }

    const questionMap: Record<string, QuizQuestion> = {};
    parsed.forEach((q) => {
      questionMap[q.id] = q;
    });

    await update(ref(db, GAME_PATH), {
      status: "waiting",
      currentQuestionIndex: 0,
      questions: questionMap,
      questionOrder: parsed.map((q) => q.id),
      responses: null,
    });

    setMessage(`${parsed.length}개 문제를 불러왔습니다.`);
  }

  async function startGame() {
    if (questions.length === 0) {
      setMessage("먼저 문제를 붙여넣고 불러오세요.");
      return;
    }
    await update(ref(db, GAME_PATH), {
      status: "question",
      currentQuestionIndex: 0,
    });
    await emitSound("question");
  }

  async function showAnswer() {
    if (!question) return;

    const updates: Record<string, unknown> = {
      [`${GAME_PATH}/status`]: "answer",
    };

    const snapshot = await get(child(ref(db), `${GAME_PATH}/students`));
    const latestStudents = snapshot.val() as Record<string, Student> | null;

    if (latestStudents) {
      responses.forEach((response) => {
        if (response.correct) {
          const prevScore = latestStudents[response.studentId]?.score ?? 0;
          updates[`${GAME_PATH}/students/${response.studentId}/score`] = prevScore + 1;
        }
      });
    }

    await update(ref(db), updates);
    await emitSound("answer");
  }

  async function nextQuestion() {
    if (!game) return;
    const nextIndex = (game.currentQuestionIndex ?? 0) + 1;
    if (nextIndex >= questions.length) {
      await update(ref(db, GAME_PATH), {
        status: "finished",
      });
      await emitSound("finish");
      return;
    }

    await update(ref(db, GAME_PATH), {
      status: "question",
      currentQuestionIndex: nextIndex,
    });
    await emitSound("question");
  }

  async function resetGame() {
    const ok = window.confirm("정말 전체 게임 데이터를 초기화할까요?");
    if (!ok) return;
    await remove(ref(db, GAME_PATH));
    await set(ref(db, GAME_PATH), {
      status: "waiting",
      currentQuestionIndex: 0,
      soundEvent: { type: "reset", timestamp: Date.now() },
    });
  }

  return (
    <main className="page admin">
      <header className="topbar">
        <div>
          <h1>강사 화면</h1>
          <p>학생 링크: 기본 주소 / 강사 링크: 기본 주소 + /admin</p>
        </div>
        <button className="danger small" onClick={resetGame}>
          <RotateCcw size={16} /> 전체 초기화
        </button>
      </header>

      <section className="grid two">
        <div className="card">
          <h2>문제 붙여넣기</h2>
          <p className="hint">형식: 문제 / 정답 / 해설. 엑셀·구글시트에서 그대로 복사하세요.</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"문제\t정답\t해설\n지구는 둥글다\tO\t지구는 둥근 형태입니다.\n태양은 행성이다\tX\t태양은 별입니다."}
          />
          <div className="row">
            <button onClick={loadQuestions}>문제 불러오기</button>
            <button className="secondary" onClick={() => setPasteText(sampleQuestions)}>
              샘플 넣기
            </button>
          </div>
          {message && <p className="message">{message}</p>}
        </div>

        <div className="card">
          <h2>게임 진행</h2>
          <div className="stats">
            <div><strong>{questions.length}</strong><span>문제</span></div>
            <div><strong>{students.length}</strong><span>학생</span></div>
            <div><strong>{responses.length}</strong><span>응답</span></div>
          </div>
          <div className="row">
            <button onClick={startGame}><Play size={16} /> 게임 시작</button>
            <button className="secondary" onClick={showAnswer}><Eye size={16} /> 정답 공개</button>
            <button className="secondary" onClick={nextQuestion}><SkipForward size={16} /> 다음 문제</button>
          </div>
          <p className="status">현재 상태: <b>{game?.status ?? "waiting"}</b></p>
        </div>
      </section>

      <section className="card">
        <h2>현재 문제</h2>
        {question ? (
          <>
            <p className="questionText">{game?.currentQuestionIndex! + 1}. {question.text}</p>
            <p className="hint">정답: {game?.status === "answer" || game?.status === "finished" ? question.answer : "정답 공개 전"}</p>
            {game?.status === "answer" && question.explanation && (
              <p className="explanation">{question.explanation}</p>
            )}
          </>
        ) : (
          <p className="hint">아직 문제가 없습니다.</p>
        )}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>실시간 응답</h2>
          <div className="oxMeter">
            <div className="oBox">O<br /><strong>{oCount}</strong></div>
            <div className="xBox">X<br /><strong>{xCount}</strong></div>
          </div>
          <div className="responseList">
            {responses.map((r) => (
              <div key={r.studentId} className="responseItem">
                <span>{r.studentName}</span>
                <b>{r.answer}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>점수판</h2>
          <div className="ranking">
            {ranking.map((s, index) => (
              <div key={s.id} className="rankItem">
                <span>{index + 1}위</span>
                <strong>{s.name}</strong>
                <b>{s.score}점</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const sampleQuestions = `문제\t정답\t해설
지구는 태양 주위를 돈다\tO\t지구는 태양을 중심으로 공전합니다.
태양은 행성이다\tX\t태양은 별입니다.
물은 일반적으로 1기압에서 100도에 끓는다\tO\t기압이 달라지면 끓는점도 달라집니다.
한글은 세종대왕 때 창제되었다\tO\t훈민정음은 세종 때 창제되었습니다.
사람의 심장은 보통 오른쪽 가슴에 있다\tX\t일반적으로 심장은 가슴 중앙에서 약간 왼쪽에 있습니다.`;

function StudentApp({ game }: { game: GameState | null }) {
  const [name, setName] = useState(localStorage.getItem("studentName") || "");
  const [studentId, setStudentId] = useState(localStorage.getItem("studentId") || "");
  const [joined, setJoined] = useState(Boolean(localStorage.getItem("studentId")));
  const lastSoundTime = useRef(0);

  const question = currentQuestion(game);
  const students = getStudents(game);
  const ranking = getRanking(game);
  const responses = getResponsesForCurrent(game);
  const myStudent = studentId ? game?.students?.[studentId] : null;
  const myResponse = question && studentId ? game?.responses?.[question.id]?.[studentId] : null;

  useEffect(() => {
    if (!studentId || !joined) return;

    const interval = setInterval(() => {
      update(ref(db, `${GAME_PATH}/students/${studentId}`), {
        lastSeen: Date.now(),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [studentId, joined]);

  useEffect(() => {
    const ev = game?.soundEvent;
    if (!ev) return;
    if (ev.timestamp <= lastSoundTime.current) return;
    lastSoundTime.current = ev.timestamp;
    playSound(ev.type);
  }, [game?.soundEvent]);

  async function joinGame() {
    const trimmed = name.trim();
    if (!trimmed) return;

    let id = studentId;
    if (!id) {
      id = createId("student");
      setStudentId(id);
      localStorage.setItem("studentId", id);
    }

    localStorage.setItem("studentName", trimmed);
    await set(ref(db, `${GAME_PATH}/students/${id}`), {
      id,
      name: trimmed,
      score: myStudent?.score ?? 0,
      joinedAt: myStudent?.joinedAt ?? Date.now(),
      lastSeen: Date.now(),
    });

    setJoined(true);
    playSound("join");
    await emitSound("join");
  }

  async function answer(value: "O" | "X") {
    if (!question || !studentId || myResponse || game?.status !== "question") return;
    const correct = value === question.answer;

    const response: ResponseItem = {
      studentId,
      studentName: myStudent?.name || name,
      answer: value,
      correct,
      answeredAt: Date.now(),
    };

    await set(ref(db, `${GAME_PATH}/responses/${question.id}/${studentId}`), response);
    playSound(correct ? "correct" : "wrong");
  }

  if (!joined) {
    return (
      <main className="page student landing">
        <section className="joinCard">
          <h1>실시간 OX 퀴즈</h1>
          <p>이름을 입력하고 입장하세요.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            onKeyDown={(e) => e.key === "Enter" && joinGame()}
          />
          <button onClick={joinGame}>입장하기</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page student">
      <header className="studentHeader">
        <div>
          <strong>{myStudent?.name || name}</strong>
          <span>{myStudent?.score ?? 0}점</span>
        </div>
        <div className="pill"><Users size={14} /> {students.length}명 참여</div>
      </header>

      {game?.status === "waiting" && (
        <section className="bigCard">
          <h1>대기 중</h1>
          <p>강사가 게임을 시작하면 문제가 표시됩니다.</p>
        </section>
      )}

      {game?.status === "question" && question && (
        <section className="quizCard">
          <p className="questionNumber">문제 {(game.currentQuestionIndex ?? 0) + 1}</p>
          <h1>{question.text}</h1>
          {myResponse ? (
            <div className="answered">
              <p>답변 완료</p>
              <strong>{myResponse.answer}</strong>
            </div>
          ) : (
            <div className="oxButtons">
              <button className="oButton" onClick={() => answer("O")}>
                <Circle size={42} /> O
              </button>
              <button className="xButton" onClick={() => answer("X")}>
                X
              </button>
            </div>
          )}
        </section>
      )}

      {game?.status === "answer" && question && (
        <section className="bigCard">
          <p className="questionNumber">정답 공개</p>
          <h1 className={question.answer === "O" ? "answerO" : "answerX"}>{question.answer}</h1>
          {myResponse ? (
            <p className={myResponse.correct ? "correctText" : "wrongText"}>
              {myResponse.correct ? "정답입니다!" : "아쉽지만 오답입니다."}
            </p>
          ) : (
            <p className="hint">이번 문제에 응답하지 않았습니다.</p>
          )}
          {question.explanation && <p className="explanation">{question.explanation}</p>}
        </section>
      )}

      {game?.status === "finished" && (
        <section className="bigCard">
          <Trophy size={56} />
          <h1>게임 종료</h1>
          <p>최종 점수: {myStudent?.score ?? 0}점</p>
          <div className="ranking compact">
            {ranking.slice(0, 10).map((s, i) => (
              <div key={s.id} className="rankItem">
                <span>{i + 1}위</span>
                <strong>{s.name}</strong>
                <b>{s.score}점</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {question && game?.status !== "waiting" && (
        <footer className="miniFooter">
          응답 현황: {responses.length}명
        </footer>
      )}
    </main>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const isAdmin = useMemo(() => window.location.pathname.startsWith("/admin"), []);

  useEffect(() => {
    loginAnonymously();

    const gameRef = ref(db, GAME_PATH);
    const unsubscribe = onValue(gameRef, async (snapshot) => {
      if (!snapshot.exists()) {
        await set(gameRef, {
          status: "waiting",
          currentQuestionIndex: 0,
        });
        return;
      }
      setGame(snapshot.val());
    });

    return () => unsubscribe();
  }, []);

  if (isAdmin) return <AdminApp game={game} />;
  return <StudentApp game={game} />;
}
