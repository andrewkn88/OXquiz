export type GameStatus = "waiting" | "question" | "answer" | "finished";

export type QuizQuestion = {
  id: string;
  text: string;
  answer: "O" | "X";
  explanation?: string;
};

export type Student = {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
  lastSeen: number;
};

export type ResponseItem = {
  studentId: string;
  studentName: string;
  answer: "O" | "X";
  correct: boolean;
  answeredAt: number;
};

export type GameState = {
  status: GameStatus;
  currentQuestionIndex: number;
  questions?: Record<string, QuizQuestion>;
  questionOrder?: string[];
  students?: Record<string, Student>;
  responses?: Record<string, Record<string, ResponseItem>>;
  soundEvent?: {
    type: "join" | "question" | "correct" | "wrong" | "answer" | "finish" | "reset";
    timestamp: number;
  };
};
