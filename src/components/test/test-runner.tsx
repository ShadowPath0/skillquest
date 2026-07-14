"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type QuestionType =
  | "MCQ"
  | "TRUE_FALSE"
  | "OPEN"
  | "PRACTICAL"
  | "CASE_STUDY"
  | "SCENARIO";

type SafeQuestion = {
  id: string;
  type: QuestionType;
  promptMd: string;
  choices: string[] | null;
  estimatedTimeSec: number;
};

type Progress = { answered: number; total: number };

type AnswerResponse = {
  isCorrect: boolean;
  explanationMd: string;
  progress: Progress;
  isComplete: boolean;
  nextQuestion: SafeQuestion | null;
};

export function TestRunner({
  sessionId,
  initialQuestion,
  initialProgress,
}: {
  sessionId: string;
  initialQuestion: SafeQuestion;
  initialProgress: Progress;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [progress, setProgress] = useState(initialProgress);
  const [answer, setAnswer] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setStartedAt(Date.now());
    setAnswer("");
  }, [question.id]);

  async function submitAnswer() {
    if (!answer.trim()) return;
    setSubmitting(true);
    const timeSpentSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    const res = await fetch(`/api/test/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        userAnswer: answer,
        timeSpentSec,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      return;
    }

    const data: AnswerResponse = await res.json();
    setFeedback(data);
    setProgress(data.progress);
    setSubmitting(false);
  }

  async function continueAfterFeedback() {
    if (!feedback) return;

    if (feedback.isComplete || !feedback.nextQuestion) {
      setFinishing(true);
      const res = await fetch(`/api/test/${sessionId}/complete`, { method: "POST" });
      const data = await res.json();
      router.push(data.redirectTo ?? "/domains");
      return;
    }

    setQuestion(feedback.nextQuestion);
    setFeedback(null);
  }

  const percent = Math.round((progress.answered / progress.total) * 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {Math.min(progress.answered + 1, progress.total)} /{" "}
            {progress.total}
          </span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} />
      </div>

      <Card>
        <CardHeader>
          <p className="text-lg font-medium">{question.promptMd}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {feedback ? (
            <div className="flex flex-col gap-4">
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  feedback.isCorrect ? "text-emerald-500" : "text-destructive"
                }`}
              >
                {feedback.isCorrect ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <XCircle className="size-5" />
                )}
                {feedback.isCorrect ? "Bonne réponse" : "Réponse incorrecte"}
              </div>
              <p className="text-sm text-muted-foreground">
                {feedback.explanationMd}
              </p>
              <Button onClick={continueAfterFeedback} disabled={finishing}>
                {feedback.isComplete ? "Voir mes résultats" : "Question suivante"}
              </Button>
            </div>
          ) : question.type !== "MCQ" && question.type !== "TRUE_FALSE" ? (
            <div className="flex flex-col gap-4">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Ta réponse..."
                rows={5}
              />
              <Button onClick={submitAnswer} disabled={submitting || !answer.trim()}>
                Valider
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <RadioGroup value={answer} onValueChange={setAnswer}>
                {(question.choices ?? []).map((choice) => (
                  <div key={choice} className="flex items-center gap-3">
                    <RadioGroupItem value={choice} id={choice} />
                    <Label htmlFor={choice} className="font-normal">
                      {choice}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button onClick={submitAnswer} disabled={submitting || !answer}>
                Valider
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
