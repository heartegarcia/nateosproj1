"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBusinesses,
  fetchProjects,
  fetchTasks,
  todayLocalISO,
} from "./api";
import type { Business, Project, Task, TaskFilters } from "@/lib/types";

export function useTaskData(fixedFilters: TaskFilters) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState<Date | null>(null);

  const filtersKey = JSON.stringify(fixedFilters);

  const refetchTasks = useCallback(async () => {
    const { tasks } = await fetchTasks({ ...fixedFilters, today: todayLocalISO() });
    setTasks(tasks);
    setAsOf(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [b, p] = await Promise.all([fetchBusinesses(), fetchProjects()]);
      if (cancelled) return;
      setBusinesses(b.businesses);
      setProjects(p.projects);
      await refetchTasks();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return { tasks, setTasks, businesses, projects, setProjects, loading, asOf, refetchTasks };
}
