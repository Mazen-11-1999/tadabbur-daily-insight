import { Component, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DataState } from "./DataState";
import { Button } from "./ui/button";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="min-h-screen bg-background px-6 py-20 text-center" dir="rtl">
      <DataState error="حدث خطأ غير متوقع. يمكنك إعادة المحاولة دون فقد بياناتك." retry={() => this.setState({ failed: false })} />
      <Button variant="outline" onClick={() => window.location.reload()}>إعادة فتح التطبيق</Button>
    </main>;
    return this.props.children;
  }
}

export function RouteDataError() {
  const router = useRouter();
  const client = useQueryClient();
  return <DataState error="تعذّر تحميل البيانات. تحقق من الاتصال ثم أعد المحاولة." retry={() => {
    void client.resetQueries();
    void router.invalidate();
  }} />;
}
export function RouteDataEmpty() { return <DataState empty="لا توجد بيانات لهذا الرابط." />; }