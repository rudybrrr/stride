"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TodosClient from "./todos-client";
import TodosSkeleton from "./todos-skeleton";
import { useData } from "~/components/data-provider";

export default function TodosGate() {
  const router = useRouter();
  const { userId, loading } = useData();

  useEffect(() => {
    if (!loading && !userId) {
      router.replace("/login");
    }
  }, [loading, router, userId]);

  if (loading) return <TodosSkeleton />;
  if (!userId) return null;

  return <TodosClient userId={userId} />;
}
