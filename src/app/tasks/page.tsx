"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { labels } from "@/config/labels";
import { Plus, Check, Circle, Clock, AlertCircle, Target } from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  recommended_action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  source: string | null;
  goal_relevance_score: number | null;
  goal_relevance_note: string | null;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const GOAL_COLORS = (score: number): string => {
  if (score >= 10) return "bg-red-100 text-red-700";
  if (score >= 7) return "bg-orange-100 text-orange-700";
  if (score >= 4) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-gray-400" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  done: <Check className="h-4 w-4 text-green-500" />,
  blocked: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newGoalScore, setNewGoalScore] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }

  const createTask = async () => {
    if (!newTitle.trim()) return;
    await supabase.from("tasks").insert({
      title: newTitle,
      summary: newSummary || null,
      recommended_action: newAction || null,
      priority: newPriority,
      status: "todo",
      due_date: newDueDate || null,
      goal_relevance_score: newGoalScore ? Number(newGoalScore) : null,
      source: "manual",
    });
    setNewTitle("");
    setNewSummary("");
    setNewAction("");
    setNewPriority("medium");
    setNewDueDate("");
    setNewGoalScore("");
    setShowNew(false);
    loadTasks();
  };

  const toggleStatus = async (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.tasksPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{tasks.filter((t) => t.status !== "done").length} open tasks</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Title</label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title..." /></div>
              <div><label className="text-xs text-gray-500">Summary / Context</label><Textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} placeholder="What is happening..." rows={2} /></div>
              <div><label className="text-xs text-gray-500">Recommended Action</label><Textarea value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="What should be done..." rows={2} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Priority</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Due Date</label>
                  <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Goal Relevance (1-10)</label>
                  <Input type="number" min="1" max="10" value={newGoalScore} onChange={(e) => setNewGoalScore(e.target.value)} placeholder="—" />
                </div>
              </div>
              <Button onClick={createTask} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "todo", "in_progress", "done", "blocked"].map((s) => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {["", "critical", "high", "medium", "low"].map((p) => (
          <Button key={p} variant={filterPriority === p ? "default" : "outline"} size="sm" onClick={() => setFilterPriority(p)}>
            {p === "" ? "All Priority" : p.charAt(0).toUpperCase() + p.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card><CardContent className="py-8 text-center text-gray-400">No tasks found.</CardContent></Card>
        )}
        {filtered.map((task) => (
          <Link key={task.id} href={`/tasks/${task.id}`}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${task.status === "done" ? "opacity-60" : ""}`}>
              <CardContent className="py-3 flex items-center gap-3">
                <button onClick={(e) => toggleStatus(e, task)} className="shrink-0">
                  {STATUS_ICONS[task.status]}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
                  {(task.summary || task.description) && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{task.summary || task.description}</p>
                  )}
                  {task.recommended_action && (
                    <p className="text-xs text-blue-500 mt-0.5 truncate">
                      <span className="font-medium">Action:</span> {task.recommended_action}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                  {task.goal_relevance_score != null && (
                    <Badge className={GOAL_COLORS(task.goal_relevance_score)}>
                      <Target className="h-3 w-3 mr-0.5" />{task.goal_relevance_score}
                    </Badge>
                  )}
                  {task.due_date && <span className="text-xs text-gray-400">{task.due_date}</span>}
                  {task.source && task.source !== "manual" && <Badge variant="outline" className="text-xs">{task.source}</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
