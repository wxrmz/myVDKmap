import { ThemeToggle } from "@/components/ThemeToggle";

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center gap-4 p-4">
      <span className="text-2xl font-semibold">Мой дом. Владивосток</span>
      <ThemeToggle />
    </main>
  );
}
