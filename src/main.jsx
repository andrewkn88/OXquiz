import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ref, onValue, set, update, remove, get, serverTimestamp } from 'firebase/database';
import { Trophy, Users, Volume2, RotateCcw, Play, Eye, SkipForward } from 'lucide-react';
import { db, ROOM_ID } from './firebase';
import './style.css';

const roomRef = ref(db, `rooms/${ROOM_ID}`);
const initialGame = {
  status: 'waiting',
  currentIndex: 0,
  showAnswer: false,
  questions: [],
  createdAt: serverTimestamp(),
};

function beep(type = 'click') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const tones = {
      join: [660, 0.12],
      correct: [880, 0.16],
      wrong: [180, 0.18],
      click: [520, 0.08],
      start: [740, 0.12],
    };
    const [freq, duration] = tones[type] || tones.click;
    osc.frequency.value = freq;
    osc.type = type === 'wrong' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (_) {}
}

function parseQuestions(text) {
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((cols) => cols.length >= 2)
    .filter((cols, i) => !(i === 0 && cols[0].includes('문제')))
    .map(([question, answer, explanation = '']) => ({
      question,
      answer: answer.toUpperCase().startsWith('O') ? 'O' : 'X',
      explanation,
    }))
    .filter((q) => q.question && ['O', 'X'].includes(q.answer));
}

function useGame() {
  const [game, setGame] = useState(null);
  useEffect(() => onValue(roomRef, (snap) => setGame(snap.val() || initialGame)), []);
  return game;
}

function getStudentId() {
  let id = localStorage.getItem('ox_student_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ox_student_id', id);
  }
  return id;
}

function StudentApp() {
  const game = useGame();
  const [name, setName] = useState(localStorage.getItem('ox_student_name') || '');
  const [joined, setJoined] = useState(Boolean(localStorage.getItem('ox_student_name')));
  const studentId = useMemo(getStudentId, []);
  const current = game?.questions?.[game?.currentIndex || 0];
  const me = game?.students?.[studentId];
  const myAnswer = game?.answers?.[game?.currentIndex]?.[studentId];
  const lastIndexRef = useRef(null);

  useEffect(() => {
    if (!game || lastIndexRef.current === null) {
      lastIndexRef.current = game?.currentIndex;
      return;
    }
    if (lastIndexRef.current !== game.currentIndex) {
      beep('start');
      lastIndexRef.current = game.currentIndex;
    }
  }, [game?.currentIndex]);

  async function join() {
    const trimmed = name.trim();
    if (!trimmed) return alert('닉네임을 입력하세요.');
    localStorage.setItem('ox_student_name', trimmed);
    await update(ref(db, `rooms/${ROOM_ID}/students/${studentId}`), {
      name: trimmed,
      score: me?.score || 0,
      joinedAt: serverTimestamp(),
    });
    setJoined(true);
    beep('join');
  }

  async function answer(choice) {
    if (!current || game.showAnswer || myAnswer) return;
    await set(ref(db, `rooms/${ROOM_ID}/answers/${game.currentIndex}/${studentId}`), {
      name: me?.name || name,
      choice,
      at: serverTimestamp(),
    });
    beep('click');
  }

  const ranking = Object.entries(game?.students || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (!game) return <Loading />;
  if (!joined) {
    return <main className="page center"><section className="card join-card"><h1>실시간 OX 퀴즈</h1><p>닉네임만 입력하고 바로 입장하세요.</p><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="예: 기남" maxLength={12}/><button onClick={join}>입장하기</button></section></main>;
  }

  return <main className="page"><header className="top"><div><b>{me?.name || name}</b><span>점수 {me?.score || 0}</span></div><Volume2 size={20}/></header>
    <section className="card hero">
      <p className="eyebrow">문제 {(game.currentIndex || 0) + 1} / {game.questions?.length || 0}</p>
      <h1>{current ? current.question : '강사가 문제를 준비 중입니다.'}</h1>
      {game.status === 'waiting' && <p>잠시 후 퀴즈가 시작됩니다.</p>}
    </section>
    {current && <section className="choice-grid"><button className={myAnswer?.choice==='O'?'selected':''} onClick={()=>answer('O')}>O</button><button className={myAnswer?.choice==='X'?'selected':''} onClick={()=>answer('X')}>X</button></section>}
    {myAnswer && !game.showAnswer && <p className="notice">답변 완료: {myAnswer.choice}</p>}
    {current && game.showAnswer && <section className="card result"><h2>정답: {current.answer}</h2><p>{current.explanation || '해설이 없습니다.'}</p><strong className={myAnswer?.choice === current.answer ? 'ok' : 'no'}>{myAnswer?.choice === current.answer ? '맞았습니다!' : '틀렸습니다'}</strong></section>}
    <section className="card"><h2><Trophy size={20}/> 순위</h2>{ranking.slice(0,5).map((s,i)=><div className="row" key={s.id}><span>{i+1}. {s.name}</span><b>{s.score || 0}</b></div>)}</section>
  </main>;
}

function AdminApp() {
  const game = useGame();
  const [password, setPassword] = useState(sessionStorage.getItem('admin_ok') || '');
  const [text, setText] = useState('문제\t정답\t해설\n태양은 별이다\tO\t태양은 스스로 빛을 내는 별입니다.\n물은 100도에서 항상 끓는다\tX\t기압에 따라 끓는점이 달라집니다.');
  const isAdmin = password === (import.meta.env.VITE_ADMIN_PASSWORD || '1234');
  const current = game?.questions?.[game?.currentIndex || 0];
  const answers = game?.answers?.[game?.currentIndex] || {};
  const students = game?.students || {};
  const answerCount = Object.keys(answers).length;
  const studentCount = Object.keys(students).length;

  if (!game) return <Loading />;
  if (!isAdmin) return <main className="page center"><section className="card join-card"><h1>강사 입장</h1><input type="password" placeholder="관리자 비밀번호" onChange={(e)=>setPassword(e.target.value)} /><button onClick={()=>sessionStorage.setItem('admin_ok', password)}>확인</button><p className="small">기본값은 .env의 VITE_ADMIN_PASSWORD입니다.</p></section></main>;

  async function loadQuestions() {
    const questions = parseQuestions(text);
    if (!questions.length) return alert('문제를 확인하세요. 문제, 정답, 해설 순서로 붙여넣으세요.');
    await set(roomRef, { ...initialGame, questions, students: game.students || {} });
    beep('start');
  }
  async function startGame() { await update(roomRef, { status: 'playing', currentIndex: 0, showAnswer: false }); beep('start'); }
  async function reveal() {
    if (!current) return;
    const updates = { showAnswer: true };
    for (const [id, ans] of Object.entries(answers)) {
      if (ans.choice === current.answer) updates[`students/${id}/score`] = (students[id]?.score || 0) + 1;
    }
    await update(roomRef, updates);
    beep('correct');
  }
  async function next() { await update(roomRef, { currentIndex: Math.min((game.currentIndex || 0) + 1, (game.questions?.length || 1) - 1), showAnswer: false }); beep('start'); }
  async function resetAll() { if (confirm('전체 데이터를 초기화할까요?')) await remove(roomRef); }

  const oCount = Object.values(answers).filter(a=>a.choice==='O').length;
  const xCount = Object.values(answers).filter(a=>a.choice==='X').length;
  const ranking = Object.entries(students).map(([id,s])=>({id,...s})).sort((a,b)=>(b.score||0)-(a.score||0));

  return <main className="page admin"><header className="top"><div><b>강사 화면</b><span>/admin</span></div><button className="ghost" onClick={resetAll}><RotateCcw size={16}/> 초기화</button></header>
    <section className="card"><h2>문제 일괄 입력</h2><textarea value={text} onChange={(e)=>setText(e.target.value)} /><button onClick={loadQuestions}>문제 불러오기</button></section>
    <section className="card hero"><p className="eyebrow">현재 문제 {(game.currentIndex || 0)+1} / {game.questions?.length || 0}</p><h1>{current?.question || '문제가 없습니다.'}</h1>{current && <p>정답: {game.showAnswer ? current.answer : '숨김'} / 해설: {game.showAnswer ? current.explanation : '숨김'}</p>}</section>
    <section className="toolbar"><button onClick={startGame}><Play size={16}/> 시작</button><button onClick={reveal}><Eye size={16}/> 정답 공개</button><button onClick={next}><SkipForward size={16}/> 다음 문제</button></section>
    <section className="grid2"><div className="card"><h2><Users size={20}/> 응답 현황</h2><p className="big">{answerCount} / {studentCount}</p><div className="bar"><i style={{width:`${studentCount?answerCount/studentCount*100:0}%`}}/></div><p>O: {oCount}명 / X: {xCount}명</p></div><div className="card"><h2>참가자 점수</h2>{ranking.map((s,i)=><div className="row" key={s.id}><span>{i+1}. {s.name}</span><b>{s.score || 0}</b></div>)}</div></section>
  </main>;
}

function Loading(){return <main className="page center"><section className="card">불러오는 중...</section></main>}
function App(){ return location.pathname.startsWith('/admin') ? <AdminApp/> : <StudentApp/>; }

createRoot(document.getElementById('root')).render(<App />);
