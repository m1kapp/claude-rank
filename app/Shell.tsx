"use client";
import { AppShell, AppShellHeader, AppShellContent, TabBar, Tab } from "@m1kapp/kit";
import { usePathname, useRouter } from "next/navigation";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const home = path === "/" || path.startsWith("/u/");
  return (
    <AppShell accent="#d97757" maxHeight={932} style={{ height: "var(--shell-h)" }}>
      <AppShellHeader>
        <div style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 17 }}>{title}</div>
      </AppShellHeader>
      <AppShellContent>{children}</AppShellContent>
      <TabBar>
        <Tab active={home} onClick={() => router.push("/")} icon={<span>🏆</span>} label="랭킹" activeColor="#d97757" />
        <Tab active={path === "/submit"} onClick={() => router.push("/submit")} icon={<span>📤</span>} label="제출" activeColor="#d97757" />
      </TabBar>
    </AppShell>
  );
}
